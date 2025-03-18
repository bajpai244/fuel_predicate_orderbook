import { Address, ScriptTransactionRequest } from 'fuels';
import express from 'express';
import { DummyApiClient } from './lib';
import { Provider, Wallet } from 'fuels';
import { OrderbookPredicate } from '../out';
import type { OrderbookPredicateInputs } from '../out/predicates/OrderbookPredicate';

if (!process.env.FUEL_PROVIDER_URL) {
  throw new Error('FUEL_PROVIDER_URL is not set');
}

if (!process.env.PRIVATE_KEY) {
  throw new Error('PRIVATE_KEY is not set');
}

const provider = new Provider(process.env.FUEL_PROVIDER_URL);
const wallet = Wallet.fromPrivateKey(process.env.PRIVATE_KEY, provider);

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

const apiClient = new DummyApiClient();

// Fill order endpoint
app.post('/fill-order', async (req, res) => {
  try {
    const {
      sellTokenName,
      buyTokenName,
      sellTokenAmount,
      buyTokenAmount,
      predicateAddress,
      // this is to get the configurable constants of the predicate
      sellTokenAssetId,
      buyTokenAssetId,
      minimalOutputAmount,
      recepient,
    } = req.body;

    // Validate required fields
    if (
      !sellTokenName ||
      !buyTokenName ||
      !sellTokenAmount ||
      !buyTokenAmount ||
      !predicateAddress ||
      !sellTokenAssetId ||
      !buyTokenAssetId ||
      !minimalOutputAmount ||
      !recepient
    ) {
      return res.status(400).json({
        error: 'Missing required parameters',
      });
    }

    const sellTokenExists = await apiClient.tokenExists(sellTokenName);
    if (!sellTokenExists) {
      return res.status(400).json({
        error: 'Sell token not found',
      });
    }

    const buyTokenExists = await apiClient.tokenExists(buyTokenName);
    if (!buyTokenExists) {
      return res.status(400).json({
        error: 'Buy token not found',
      });
    }

    // Get current prices for validation
    const sellTokenPrice = await apiClient.getTokenPrice(sellTokenName);
    const buyTokenPrice = await apiClient.getTokenPrice(buyTokenName);

    // Calculate total values
    const sellValue = sellTokenAmount * sellTokenPrice;
    const buyValue = buyTokenAmount * buyTokenPrice;

    console.log('sell value', sellValue);
    console.log('buy value', buyValue);

    // Basic validation of the order
    if (sellValue <= 0 || buyValue <= 0) {
      return res.status(400).json({
        error: 'Invalid token amounts',
      });
    }

    const orderBookPredicate = new OrderbookPredicate({
      configurableConstants: {
        ASSET_ID_SEND: sellTokenAssetId,
        ASSET_ID_GET: buyTokenAssetId,
        MINIMAL_OUTPUT_AMOUNT: minimalOutputAmount,
        RECEPIENT: recepient,
      },
      provider,
    });

    if (orderBookPredicate.address.toB256() !== predicateAddress) {
      return res.status(400).json({
        error: 'Invalid predicate address',
      });
    }

    const sellResources = await orderBookPredicate.getResourcesToSpend([
      {
        assetId: sellTokenAssetId,
        amount: sellTokenAmount,
      },
    ]);

    if (sellResources.length === 0) {
      return res.status(400).json({
        error: 'Not enough funds in predicate for sell token',
      });
    }

    const buyResources = await wallet.getResourcesToSpend([
      {
        assetId: buyTokenAssetId,
        amount: buyTokenAmount,
      },
    ]);

    if (buyResources.length === 0) {
      return res.status(400).json({
        error: 'Not enough funds in wallet for buy token',
      });
    }

    const scriptRequest = new ScriptTransactionRequest({
      gasLimit: 100000,
    });

    scriptRequest.addResources(sellResources);
    scriptRequest.addResources(buyResources);

    scriptRequest.outputs = [];

    scriptRequest.addCoinOutput(
      Address.fromAddressOrString(recepient),
      buyTokenAmount,
      buyTokenAssetId
    );

    scriptRequest.addCoinOutput(
      wallet.address,
      sellTokenAmount,
      sellTokenAssetId
    );

    const predicateData: OrderbookPredicateInputs = [0, undefined];
    orderBookPredicate.predicateData = predicateData;

    orderBookPredicate.populateTransactionPredicateData(scriptRequest);

    await scriptRequest.estimateAndFund(wallet);

    const userSellTokenBalanceBefore = await provider.getBalance(
      recepient,
      sellTokenAssetId
    );
    const userBuyTokenBalanceBefore = await provider.getBalance(
      recepient,
      buyTokenAssetId
    );

    const solverSellTokenBalanceBefore = await provider.getBalance(
      wallet.address,
      sellTokenAssetId
    );
    const solverBuyTokenBalanceBefore = await provider.getBalance(
      wallet.address,
      buyTokenAssetId
    );

    const result = await (
      await wallet.sendTransaction(scriptRequest, {
        enableAssetBurn: true,
      })
    ).waitForResult();

    const userSellTokenBalanceAfter = await provider.getBalance(
      recepient,
      sellTokenAssetId
    );
    const userBuyTokenBalanceAfter = await provider.getBalance(
      recepient,
      buyTokenAssetId
    );

    const solverSellTokenBalanceAfter = await provider.getBalance(
      wallet.address,
      sellTokenAssetId
    );
    const solverBuyTokenBalanceAfter = await provider.getBalance(
      wallet.address,
      buyTokenAssetId
    );

    const sellTokenDelta = solverSellTokenBalanceAfter.sub(
      solverSellTokenBalanceBefore
    );
    const buyTokenDelta = userBuyTokenBalanceAfter.sub(
      userBuyTokenBalanceBefore
    );

    console.log(`solver recieved ${sellTokenDelta} of ${sellTokenName}`);
    console.log(`user recieved ${buyTokenDelta} of ${buyTokenName}`);

    console.log('transaction status:', result.status);
    console.log('transaction hash:', result.id);

    res.status(200).json({
      status: 'success',
      order: {
        sellTokenName,
        buyTokenName,
        sellTokenAmount,
        buyTokenAmount,
        predicateAddress,
        sellValue,
        buyValue,
        transactionHash: result.id,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error processing fill order:', error);
    res.status(500).json({
      error: 'Failed to process order',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
