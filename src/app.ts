import express from 'express';
import {
  Address,
  BN,
  createAssetId,
  InputType,
  Provider,
  ScriptTransactionRequest,
  Wallet,
  ZeroBytes32,
} from 'fuels';
import { DummyStablecoin } from '../out';
import { PythApiClient } from './lib';
import assets from '../assets.json';
import { ScriptRequestSchema, setRequestFields } from './schema';

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

// const apiClient = new DummyApiClient();
const apiClient = new PythApiClient();

// Fill order endpoint
app.post('/fill-order', async (req, res) => {
  const {
    sellTokenName,
    sellTokenAmount: sellTokenAmountString,
    scriptRequest,
    recepientAddress,
  } = req.body;
  if (
    !sellTokenName ||
    !scriptRequest ||
    !sellTokenAmountString ||
    !recepientAddress
  ) {
    return res.status(400).json({
      error:
        'sellTokenName, scriptRequest, sellTokenAmount and recepientAddress are required',
    });
  }

  const sellTokenAmount = new BN(sellTokenAmountString);

  const { success, error, data } = ScriptRequestSchema.safeParse(scriptRequest);

  if (!success) {
    return res.status(400).json({
      error: 'Invalid request body',
    });
  }

  const request = new ScriptTransactionRequest();
  setRequestFields(request, data);

  const tokenExists = await apiClient.tokenExists(sellTokenName.toLowerCase());
  if (!tokenExists) {
    return res.status(400).json({
      error: 'Sell token not found',
    });
  }

  // @ts-ignore: the above check ensures that the tokenName is valid
  const contractId = assets[sellTokenName.toLowerCase()];
  const assetId = createAssetId(contractId, ZeroBytes32);

  const usdcAssetId = createAssetId(assets.usdc, ZeroBytes32);

  let inputAmount = new BN(0);

  const baseAssetId = await provider.getBaseAssetId();
  request.inputs.forEach((i) => {
    if (i.type === InputType.Coin) {
      if (i.assetId !== assetId.bits && i.assetId !== baseAssetId) {
        return res.status(400).json({
          error: 'Invalid input asset id',
        });
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
    return res.status(400).json({
      error: 'Not enough funds in inputs',
    });
  }

  const sellTokenPrice = await apiClient.getTokenPrice(sellTokenName);
  const totalOutputAmount = sellTokenAmount.mul(sellTokenPrice);

  console.log('totalOutputAmount', totalOutputAmount);

  const usdcResources = await wallet.getResourcesToSpend([
    {
      assetId: usdcAssetId.bits,
      amount: totalOutputAmount,
    },
  ]);

  request.addResources(usdcResources);
  request.addCoinOutput(Address.fromB256(recepientAddress), totalOutputAmount, usdcAssetId.bits);
  request.addChangeOutput(wallet.address, usdcAssetId.bits);

  request.maxFee = new BN(0);
  request.gasLimit = new BN(0);

  const { gasPrice, gasLimit, maxGas } = await provider.estimateTxGasAndFee({
    transactionRequest: request,
  });

  request.gasLimit = gasLimit;
  request.maxFee = maxGas;

  const signedRequest = await wallet.signTransaction(request);

  let witnessIndex = -1;
  request.inputs.forEach((i) => {
    if (i.type === InputType.Coin) {
      if (i.assetId === usdcAssetId.bits) {
        witnessIndex = i.witnessIndex;
      }
    }
  });

  if (witnessIndex === -1) {
    return res.status(400).json({
      error: 'Not enough USDC in inputs',
    });
  }

  request.witnesses[witnessIndex] = signedRequest;

  res.status(200).json({
    status: 'success',
    request: request.toJSON(),
  });
});

app.get('/price/:tokenName', async (req, res) => {
  const { tokenName } = req.params;
  const price = await apiClient.getTokenPrice(tokenName);
  res.status(200).json({
    price,
  });
});

app.post('/mint', async (req, res) => {
  const { tokenName, address, amount } = req.body as {
    tokenName: string;
    address: string;
    amount: number;
  };

  const tokenExists = await apiClient.tokenExists(tokenName.toLowerCase());
  if (!tokenExists) {
    return res.status(400).json({
      error: 'Token not found',
    });
  }

  // @ts-ignore: the above check ensures that the tokenName is valid
  const contractId = assets[tokenName.toLowerCase()];
  const assetId = createAssetId(contractId, ZeroBytes32);

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
    return res.status(400).json({
      error: 'Failed to mint token',
    });
  }

  res.status(200).json({
    status: 'success',
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
