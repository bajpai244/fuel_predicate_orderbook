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
  try {
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to check health',
    });
  }
});

// const apiClient = new DummyApiClient();
const apiClient = new PythApiClient();

// Fill order endpoint
app.post('/fill-order', async (req, res) => {
  try {
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
      return res.status(400).json({
        error:
          'sellTokenName, scriptRequest, sellTokenAmount and recepientAddress are required',
      });
    }

    const sellTokenAmount = new BN(sellTokenAmountString);

    const { success, error, data } =
      ScriptRequestSchema.safeParse(scriptRequest);

    if (!success) {
      return res.status(400).json({
        error: 'Invalid request body',
      });
    }

    const request = new ScriptTransactionRequest();
    setRequestFields(request, data);

    const sellTokenExists = await apiClient.tokenExists(
      sellTokenName.toLowerCase()
    );
    if (!sellTokenExists) {
      return res.status(400).json({
        error: 'Sell token not found',
      });
    }

    const sellContractId =
      assets[sellTokenName.toLowerCase() as keyof typeof assets];
    const sellAssetId = createAssetId(sellContractId, ZeroBytes32);

    const buyTokenExists = await apiClient.tokenExists(
      buyTokenName.toLowerCase()
    );
    if (!buyTokenExists) {
      return res.status(400).json({
        error: 'Buy token not found',
      });
    }
    const buyContractId =
      assets[buyTokenName.toLowerCase() as keyof typeof assets];
    const buyAssetId = createAssetId(buyContractId, ZeroBytes32);

    let inputAmount = new BN(0);

    const baseAssetId = await provider.getBaseAssetId();
    request.inputs.forEach((i) => {
      if (i.type === InputType.Coin) {
        if (i.assetId !== sellAssetId.bits && i.assetId !== baseAssetId) {
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
      return res.status(400).json({
        error: 'Not enough buy token in inputs',
      });
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
});

app.get('/price/:tokenName', async (req, res) => {
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
});

app.post('/mint', async (req, res) => {
  try {
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
  } catch (error) {
    console.error(error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to mint token',
    });
  }
});

app.post('/mint-all', async (req, res) => {
  try {
    const { address } = req.body as {
      address: string;
    };

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
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
