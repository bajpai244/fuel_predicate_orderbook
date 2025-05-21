import type { RequestHandler } from 'express';
import {
  Address,
  BN,
  createAssetId,
  hexlify,
  InputCoinCoder,
  InputType,
  Provider,
  ScriptRequest,
  ScriptTransactionRequest,
  UtxoIdCoder,
  ZeroBytes32,
  type Coin,
  type InputCoin,
} from 'fuels';
import { DummyStablecoin, OrderbookPredicate } from '../out';
import { PythApiClient } from './lib';
import assets from '../assets.json';
import { ScriptRequestSchema, setRequestFields } from './schema';
import type { z } from 'zod';
import { WalletPool } from './lib/wallet-pool';

export const createRoutes = (provider: Provider, walletPool: WalletPool) => {
  const apiClient = new PythApiClient();

  const healthCheck: RequestHandler = (req, res) => {
    try {
      res.status(200).json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        walletCount: walletPool.getWalletCount(),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to check health',
      });
    }
  };

  const fillOrder: RequestHandler = async (req, res) => {
    const start = process.hrtime.bigint();

    try {
      const wallet = await walletPool.getWallet();
      if (!wallet) {
        res.status(503).json({
          error: 'No available wallets at the moment. Please try again later.',
        });
        return;
      }

      const {
        sellTokenName,
        sellTokenAmount: sellTokenAmountString,
        recepientAddress,
        buyTokenName,
        predicateAddress,
        minimalBuyAmount,
        predicateScriptRequest,
      } = req.body;
      if (
        !sellTokenName ||
        !sellTokenAmountString ||
        !recepientAddress ||
        !buyTokenName ||
        !predicateAddress ||
        !minimalBuyAmount ||
        !predicateScriptRequest
      ) {
        res.status(400).json({
          error:
            'sellTokenName, sellTokenAmount, recepientAddress, buyTokenName, predicateAddress, minimalBuyAmount and predicateScriptRequest are required',
        });
        return;
      }

      const sellTokenExists = await apiClient.tokenExists(
        sellTokenName.toLowerCase()
      );
      if (!sellTokenExists) {
        res.status(400).json({
          error: 'Sell token not found',
        });
        return;
      }

      const sellTokenAmount = new BN(sellTokenAmountString);

      const sellContractId =
        assets[sellTokenName.toLowerCase() as keyof typeof assets];
      const sellAssetId = createAssetId(sellContractId, ZeroBytes32);

      const buyTokenExists = await apiClient.tokenExists(
        buyTokenName.toLowerCase()
      );
      if (!buyTokenExists) {
        res.status(400).json({
          error: 'Buy token not found',
        });
        return;
      }

      const buyContractId =
        assets[buyTokenName.toLowerCase() as keyof typeof assets];
      const buyAssetId = createAssetId(buyContractId, ZeroBytes32);

      const predicateScriptTransactionRequest = ScriptTransactionRequest.from(
        predicateScriptRequest
      );

      // transfer assets to the predicate
      console.log('transferring sell token to order predicate');
      const predicateTransactionTimerStart = process.hrtime.bigint();
      const { id: predicateTransactionId } = await (
        await provider.sendTransaction(predicateScriptTransactionRequest)
      ).waitForPreConfirmation();
      console.log('sell token transferred to order predicate');
      const predicateTransactionDuration =
        Number(process.hrtime.bigint() - predicateTransactionTimerStart) /
        1000000; // Convert to milliseconds

      const sellTokenPriceTimerStart = process.hrtime.bigint();
      const sellTokenPrice = await apiClient.getTokenPrice(sellTokenName);
      const sellTokenPriceDuration =
        Number(process.hrtime.bigint() - sellTokenPriceTimerStart) / 1000000; // Convert to milliseconds
      const totalSellTokenAmountUSDC = sellTokenAmount.mul(sellTokenPrice);

      console.log('totalOutputAmountUSDC', totalSellTokenAmountUSDC);

      const buyTokenPriceTimerStart = process.hrtime.bigint();
      const buyTokenPrice = await apiClient.getTokenPrice(buyTokenName);
      const buyTokenPriceDuration =
        Number(process.hrtime.bigint() - buyTokenPriceTimerStart) / 1000000; // Convert to milliseconds
      const buyTokenAmount = new BN(
        Math.floor(totalSellTokenAmountUSDC.toNumber() / buyTokenPrice)
      );

      const totalOutputAmount = buyTokenAmount;

      const buyResourcesTimerStart = process.hrtime.bigint();
      const buyResources = await wallet.getResourcesToSpend([
        {
          assetId: buyAssetId.bits,
          amount: buyTokenAmount,
        },
      ]);
      const buyResourcesDuration =
        Number(process.hrtime.bigint() - buyResourcesTimerStart) / 1000000; // Convert to milliseconds

      const orderPredicate = new OrderbookPredicate({
        configurableConstants: {
          ASSET_ID_GET: buyAssetId.bits,
          ASSET_ID_SEND: sellAssetId.bits,
          MINIMAL_OUTPUT_AMOUNT: new BN(minimalBuyAmount),
          RECEPIENT: recepientAddress,
        },
        data: [2],
        provider,
      });

      console.log('ASSET_ID_GET', buyAssetId.bits);
      console.log('ASSET_ID_SEND', sellAssetId.bits);
      console.log('MINIMAL_OUTPUT_AMOUNT', minimalBuyAmount);
      console.log('RECEPIENT', recepientAddress);

      const orderPredicateAddress = orderPredicate.address;

      console.log('predicateAddress', predicateAddress);
      console.log('orderPredicateAddress', orderPredicateAddress);
      if (orderPredicateAddress.toB256().toLowerCase() !== predicateAddress) {
        res.status(400).json({
          error: `Invalid predicate address, expected ${predicateAddress} but got ${orderPredicateAddress}`,
        });
        return;
      }

      // const utxoIdCoder = new UtxoIdCoder();
      // const sellUtxoId = hexlify(utxoIdCoder.encode({
      //   transactionId: predicateTransactionId,
      //   // It is a 1 input 1 output transaction
      //   outputIndex: 0
      // }));

      const getSellResourcesTimerStart = process.hrtime.bigint();
      const sellResource = (
        await orderPredicate.getResourcesToSpend([
          {
            assetId: sellAssetId.bits,
            amount: sellTokenAmount,
          },
        ])
      ).find(({ amount }) => {
        return amount.gte(sellTokenAmount);
      });
      const getSellResourcesDuration =
        Number(process.hrtime.bigint() - getSellResourcesTimerStart) / 1000000; // Convert to milliseconds

      if (!sellResource) {
        res.status(400).json({
          error: 'no sell resources found',
        });
        return;
      }

      const scriptRequest = new ScriptTransactionRequest();

      scriptRequest.addResource(sellResource);
      scriptRequest.addResources(buyResources);

      scriptRequest.addCoinOutput(
        Address.fromAddressOrString(recepientAddress),
        buyTokenAmount,
        buyAssetId.bits
      );
      scriptRequest.addCoinOutput(
        wallet.address,
        sellTokenAmount,
        sellAssetId.bits
      );

      const estimateAndFundTimerStart = process.hrtime.bigint();
      await scriptRequest.estimateAndFund(wallet);
      const estimateAndFundDuration =
        Number(process.hrtime.bigint() - estimateAndFundTimerStart) / 1000000; // Convert to milliseconds

      const buyOutputIndex = scriptRequest.outputs.findIndex((output) => {
        if (output.type === 0) {
          if (
            output.assetId === buyAssetId.bits &&
            output.amount === buyTokenAmount
          ) {
            return true;
          }
        }
        return false;
      });

      if (buyOutputIndex === -1) {
        res.status(500).json({
          error: 'Buy output not found',
        });
        return;
      }

      console.log('buy output index: ', buyOutputIndex);

      const sendTransactionTimerStart = process.hrtime.bigint();
      const result = await (
        await wallet.sendTransaction(scriptRequest)
      ).waitForPreConfirmation();
      const sendTransactionDuration =
        Number(process.hrtime.bigint() - sendTransactionTimerStart) / 1000000; // Convert to milliseconds

      console.log('transactionId', result.id);

      res.status(200).json({
        status: 'success',
        transactionId: result.id,
        buyTokenAmount: buyTokenAmount.toString(),
      });

      console.log('duration breakdown:');
      console.log('predicate transaction', predicateTransactionDuration);
      console.log('sell token price', sellTokenPriceDuration);
      console.log('buy token price', buyTokenPriceDuration);
      console.log('buy resources', buyResourcesDuration);
      console.log('get sell resources', getSellResourcesDuration);
      console.log('estimate and fund', estimateAndFundDuration);
      console.log('send transaction', sendTransactionDuration);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fill order',
      });
    }

    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1000000; // Convert to milliseconds
    console.log(`${req.method} ${req.url} - ${duration.toFixed(2)}ms`);
  };

  const getPrice: RequestHandler = async (req, res) => {
    try {
      const { tokenName } = req.params;
      const price = await apiClient.getTokenPrice(tokenName);
      res.status(200).json({
        price,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to get token price',
      });
    }
  };

  const mint: RequestHandler = async (req, res) => {
    try {
      const { tokenName, address, amount } = req.body as {
        tokenName: string;
        address: string;
        amount: number;
      };

      const tokenExists = await apiClient.tokenExists(tokenName.toLowerCase());
      if (!tokenExists) {
        res.status(400).json({
          error: 'Token not found',
        });
        return;
      }

      const wallet = await walletPool.getWallet();
      if (!wallet) {
        res.status(503).json({
          error: 'No available wallets at the moment. Please try again later.',
        });
        return;
      }

      // @ts-ignore: the above check ensures that the tokenName is valid
      const contractId = assets[tokenName.toLowerCase()];
      const coin = new DummyStablecoin(contractId, wallet);

      const { transactionResult } = await (
        await coin.functions
          .mint(
            {
              Address: {
                bits: address,
              },
            },
            ZeroBytes32,
            amount
          )
          .call()
      ).waitForResult();

      if (transactionResult.status !== 'success') {
        res.status(400).json({
          error: 'Failed to mint token',
        });
        return;
      }

      res.status(200).json({
        status: 'success',
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to mint token',
      });
    }
  };

  const mintAll: RequestHandler = async (req, res) => {
    try {
      const { address } = req.body as {
        address: string;
      };

      const wallet = await walletPool.getWallet();
      if (!wallet) {
        res.status(503).json({
          error: 'No available wallets at the moment. Please try again later.',
        });
        return;
      }

      const usdcContract = new DummyStablecoin(assets.usdc, wallet);
      const fuelContract = new DummyStablecoin(assets.fuel, wallet);
      const ethContract = new DummyStablecoin(assets.eth, wallet);
      const btcContract = new DummyStablecoin(assets.btc, wallet);

      const usdcCall = usdcContract.functions.mint(
        {
          Address: {
            bits: address,
          },
        },
        ZeroBytes32,
        // 1000 usdc
        new BN(10).pow(9).mul(1000)
      );

      const fuelCall = fuelContract.functions.mint(
        {
          Address: {
            bits: address,
          },
        },
        ZeroBytes32,
        // 10000 fuel
        new BN(10).pow(9).mul(10000)
      );

      const ethCall = ethContract.functions.mint(
        {
          Address: {
            bits: address,
          },
        },
        ZeroBytes32,
        // 0.1 eth
        new BN(10).pow(8)
      );

      const btcCall = btcContract.functions.mint(
        {
          Address: {
            bits: address,
          },
        },
        ZeroBytes32,
        // 0.1 btc
        new BN(10).pow(8)
      );

      const multiCall = fuelContract.multiCall([
        usdcCall,
        fuelCall,
        ethCall,
        btcCall,
      ]);
      const callResult = await (await multiCall.call()).waitForResult();

      res.status(200).json({
        status: 'success',
        transactionId: callResult.transactionId,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to mint token',
      });
    }
  };

  return {
    healthCheck,
    fillOrder,
    getPrice,
    mint,
    mintAll,
  };
};
