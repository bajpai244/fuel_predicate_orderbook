import {
  BN,
  createAssetId,
  Provider,
  ScriptTransactionRequest,
  Wallet,
  ZeroBytes32,
} from 'fuels';
import axios from 'axios';
import assets from '../assets.json';
import { OrderbookPredicate } from '../out';

// it sells 1 ETH for market price
const main = async () => {
  // const SERVER_URL = 'http://localhost:3000';
  const SERVER_URL = 'https://fuelstation-mainnet.xyz';

  const FUEL_PROVIDER_URL = process.env.FUEL_PROVIDER_URL;
  if (!FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }

  const PRIVATE_KEYS = process.env.PRIVATE_KEYS;
  if (!PRIVATE_KEYS) {
    throw new Error('PRIVATE_KEYS is not set');
  }

  const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;
  if (!USER_PRIVATE_KEY) {
    throw new Error('USER_PRIVATE_KEY is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);
  const solverWallets = PRIVATE_KEYS.split(',').map((privateKey) =>
    Wallet.fromPrivateKey(privateKey, provider)
  );

  const userWallet = Wallet.fromPrivateKey(USER_PRIVATE_KEY, provider);

  const sellTokenName = 'eth';
  const buyTokenName = 'usdc';

  const sellTokenAmount = new BN(10 ** 9);

  const sellTokenAssetId = createAssetId(assets[sellTokenName], ZeroBytes32);
  const buyTokenAssetId = createAssetId(assets[buyTokenName], ZeroBytes32);

  // TODO: we should query the price API to set this up
  const minimalBuyAmount = new BN(0);

  const orderPredicate = new OrderbookPredicate({
    configurableConstants: {
      ASSET_ID_GET: buyTokenAssetId.bits,
      ASSET_ID_SEND: sellTokenAssetId.bits,
      MINIMAL_OUTPUT_AMOUNT: minimalBuyAmount,
      RECEPIENT: userWallet.address.b256Address,
    },
    provider,
  });

  console.log('ASSET_ID_GET', buyTokenAssetId.bits);
  console.log('ASSET_ID_SEND', sellTokenAssetId.bits);
  console.log('MINIMAL_OUTPUT_AMOUNT', minimalBuyAmount);
  console.log('RECEPIENT', userWallet.address.b256Address);

  console.log('order predicate address', orderPredicate.address);

  const scriptRequest = new ScriptTransactionRequest();
  userWallet.addTransfer(scriptRequest, {
    destination: orderPredicate.address,
    amount: sellTokenAmount,
    assetId: sellTokenAssetId.bits,
  });

  await scriptRequest.estimateAndFund(userWallet);
  await userWallet.populateTransactionWitnessesSignature(scriptRequest);

  const { data } = await axios.post(`${SERVER_URL}/fill-order`, {
    sellTokenName,
    sellTokenAmount: sellTokenAmount.toString(),
    recepientAddress: userWallet.address.b256Address,
    buyTokenName,
    predicateAddress: orderPredicate.address.b256Address,
    minimalBuyAmount,
    predicateScriptRequest: scriptRequest.toJSON(),
  });

  console.log('transactionId', data.transactionId);
  console.log('buyTokenAmount', data.buyTokenAmount);
};

main();
