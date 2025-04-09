import type { RequestHandler } from 'express';
import {
  Address,
  BN,
  createAssetId,
  InputType,
  Provider,
  ScriptTransactionRequest,
  ZeroBytes32,
} from 'fuels';
import { DummyStablecoin } from '../out';
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
        scriptRequest,
        recepientAddress,
        buyTokenName,
      } = req.body;
      if (
        !sellTokenName ||
        !scriptRequest ||
        !sellTokenAmountString ||
        !recepientAddress ||
        !buyTokenName
      ) {
        res.status(400).json({
          error:
            'sellTokenName, scriptRequest, sellTokenAmount and recepientAddress are required',
        });
        return;
      }

      const sellTokenAmount = new BN(sellTokenAmountString);

      const { success, error, data } =
        ScriptRequestSchema.safeParse(scriptRequest);

      if (!success) {
        res.status(400).json({
          error: 'Invalid request body',
        });
        return;
      }

      const request = new ScriptTransactionRequest();
      setRequestFields(request, data as z.infer<typeof ScriptRequestSchema>);

      const sellTokenExists = await apiClient.tokenExists(
        sellTokenName.toLowerCase()
      );
      if (!sellTokenExists) {
        res.status(400).json({
          error: 'Sell token not found',
        });
        return;
      }

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

      let inputAmount = new BN(0);

      const baseAssetId = await provider.getBaseAssetId();
      request.inputs.forEach((i) => {
        if (i.type === InputType.Coin) {
          if (i.assetId !== sellAssetId.bits && i.assetId !== baseAssetId) {
            res.status(400).json({
              error: 'Invalid input asset id',
            });
            return;
          }

          inputAmount = inputAmount.add(new BN(i.amount));
        } else {
          res.status(400).json({
            error: 'Invalid input type, only coin inputs are supported',
          });
          return;
        }
      });

      if (inputAmount.lt(sellTokenAmount)) {
        res.status(400).json({
          error: 'Not enough funds in inputs',
        });
        return;
      }

      const sellTokenPrice = await apiClient.getTokenPrice(sellTokenName);
      const totalOutputAmountUSDC = sellTokenAmount.mul(sellTokenPrice);

      console.log('totalOutputAmountUSDC', totalOutputAmountUSDC);

      let buyTokenPrice = await apiClient.getTokenPrice(buyTokenName);
      let buyTokenAmount = new BN(
        Math.floor(totalOutputAmountUSDC.toNumber() / buyTokenPrice)
      );

      const totalOutputAmount = buyTokenAmount;

      const buyResources = await wallet.getResourcesToSpend([
        {
          assetId: buyAssetId.bits,
          amount: totalOutputAmount,
        },
      ]);

      request.addResources(buyResources);
      request.addCoinOutput(
        Address.fromB256(recepientAddress),
        totalOutputAmount,
        buyAssetId.bits
      );
      request.addChangeOutput(wallet.address, buyAssetId.bits);

      request.maxFee = new BN(0);
      request.gasLimit = new BN(0);

      const { gasLimit, maxFee } = await provider.estimateTxGasAndFee({
        transactionRequest: request,
      });

      request.gasLimit = gasLimit;
      request.maxFee = maxFee;

      const signedRequest = await wallet.signTransaction(request);

      let witnessIndex = -1;
      request.inputs.forEach((i) => {
        if (i.type === InputType.Coin) {
          if (i.assetId === buyAssetId.bits) {
            witnessIndex = i.witnessIndex;
          }
        }
      });

      if (witnessIndex === -1) {
        res.status(400).json({
          error: 'Not enough buy token in inputs',
        });
        return;
      }

      request.witnesses[witnessIndex] = signedRequest;

      res.status(200).json({
        status: 'success',
        request: request.toJSON(),
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        status: 'error',
        message: 'Failed to fill order',
      });
    }
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
