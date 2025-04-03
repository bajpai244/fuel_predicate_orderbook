import {
  BN,
  createAssetId,
  Provider,
  ScriptRequest,
  ScriptTransactionRequest,
  Wallet,
  ZeroBytes32,
} from 'fuels';
import axios from 'axios';
import assets from '../assets.json';
import { setRequestFields } from '../src/schema';

// it sells 1 ETH for market price
const main = async () => {
  const FUEL_PROVIDER_URL = process.env.FUEL_PROVIDER_URL;
  if (!FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set');
  }

  const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;
  if (!USER_PRIVATE_KEY) {
    throw new Error('USER_PRIVATE_KEY is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);
  const solverWallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);

  const userWallet = Wallet.fromPrivateKey(USER_PRIVATE_KEY, provider);

  const sellTokenName = 'eth';
  const buyTokenName = 'btc';

  const sellTokenAssetId = createAssetId(assets[sellTokenName], ZeroBytes32);
  const buyTokenAssetId = createAssetId(assets[buyTokenName], ZeroBytes32);

  const scriptTransactionRequest = new ScriptTransactionRequest();

  // // 1 eth
  const sellTokenAmount = new BN(10 ** 9);
  const resources = await userWallet.getResourcesToSpend([
    {
      assetId: sellTokenAssetId.bits,
      amount: sellTokenAmount,
    },
  ]);

  scriptTransactionRequest.addResources(resources);

  const baseResources = await userWallet.getResourcesToSpend([
    {
      assetId: await provider.getBaseAssetId(),
      amount: new BN(100000000),
    },
  ]);

  scriptTransactionRequest.addResources(baseResources);
  scriptTransactionRequest.addCoinOutput(
    solverWallet.address,
    sellTokenAmount,
    sellTokenAssetId.bits
  );
  scriptTransactionRequest.addChangeOutput(
    userWallet.address,
    sellTokenAssetId.bits
  );

  const { data } = await axios.post('http://localhost:3000/fill-order', {
    scriptRequest: scriptTransactionRequest.toJSON(),
    sellTokenName,
    buyTokenName,
    sellTokenAmount: sellTokenAmount.toString(),
    recepientAddress: userWallet.address.b256Address,
  });

  const responseRequest = new ScriptTransactionRequest();
  setRequestFields(responseRequest, data.request);

  // console.log(responseRequest.inputs);

  const tx = await (
    await userWallet.sendTransaction(responseRequest)
  ).waitForResult();
  console.log(tx.id);
};

main();
