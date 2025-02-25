import { createAssetId, Provider, Wallet, ZeroBytes32 } from 'fuels';
import { DummyApiClient } from '../src/lib';
import axios from 'axios';
import assets from '../assets.json';
import { OrderbookPredicate } from '../out';

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

  const apiClient = new DummyApiClient();

  const sellTokenName = 'eth';
  const buyTokenName = 'usdc';

  const sellTokenAssetId = createAssetId(assets[sellTokenName], ZeroBytes32);
  const buyTokenAssetId = createAssetId(assets[buyTokenName], ZeroBytes32);

  const sellTokenPrice = await apiClient.getTokenPrice(sellTokenName);
  const buyTokenPrice = await apiClient.getTokenPrice(buyTokenName);

  const sellTokenAmount = 1;
  const buyTokenAmount = sellTokenPrice * sellTokenAmount;

  console.log('sell token price', sellTokenPrice);
  console.log('buy token price', buyTokenPrice);

  console.log('sell token amount', sellTokenAmount);
  console.log('buy token amount', buyTokenAmount);

  const orderBookPredicate = new OrderbookPredicate({
    configurableConstants: {
      ASSET_ID_GET: buyTokenAssetId.bits,
      ASSET_ID_SEND: sellTokenAssetId.bits,
      MINIMAL_OUTPUT_AMOUNT: buyTokenAmount,
      RECEPIENT: userWallet.address.toB256(),
    },
    provider,
  });

  const predicateAddress = orderBookPredicate.address;
  console.log('predicate address', predicateAddress.toB256());

  console.log('locking funds in predicate');

  console.log(
    'predicate balances before:',
    await orderBookPredicate.getBalances()
  );

  const { status } = await (
    await userWallet.transfer(
      predicateAddress,
      sellTokenAmount,
      sellTokenAssetId.bits
    )
  ).waitForResult();

  console.log(
    'predicate balances after:',
    await orderBookPredicate.getBalances()
  );

  if (status !== 'success') {
    throw new Error('failed to lock funds in predicate');
  }

  axios.post('http://localhost:3000/fill-order', {
    sellTokenName,
    buyTokenName,
    sellTokenAmount,
    buyTokenAmount,
    predicateAddress: predicateAddress.toB256(),
    sellTokenAssetId: sellTokenAssetId.bits,
    buyTokenAssetId: buyTokenAssetId.bits,
    minimalOutputAmount: buyTokenAmount,
    recepient: userWallet.address.toB256(),
  });
};

main();
