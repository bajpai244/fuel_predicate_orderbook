import {
  bn,
  Provider,
  ScriptRequest,
  ScriptTransactionRequest,
  Wallet,
  ZeroBytes32,
} from 'fuels';
import { DummyStablecoin, OrderbookPredicate } from '../out/index';
import { describe, test } from 'bun:test';
import { deployStableCoin, mintAsset } from './lib';

describe('Orderbook Predicate', async () => {
  if (!process.env.FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set');
  }

  const fuelProvider = new Provider(process.env.FUEL_PROVIDER_URL);

  const wallet = Wallet.fromPrivateKey(process.env.PRIVATE_KEY, fuelProvider);
  const recepient = Wallet.generate({ provider: fuelProvider });

  // send some eth to recepient
  await (await wallet.transfer(recepient.address, 10000)).waitForResult();

  const { contractId: contractIdAssetA, assetId: assetIdA } =
    await deployStableCoin(wallet);
  const { contractId: contractIdAssetB, assetId: assetIdB } =
    await deployStableCoin(wallet);

  const stableCoinA = new DummyStablecoin(contractIdAssetA, wallet);
  const stableCoinB = new DummyStablecoin(contractIdAssetB, wallet);

  await mintAsset({
    stableCoin: stableCoinA,
    amount: bn(10),
    reciever: recepient,
  });

  await mintAsset({
    stableCoin: stableCoinB,
    amount: bn(10),
    reciever: wallet,
  });

  console.log(
    'recepient balance of assetA after minting is,',
    await recepient.getBalance(assetIdA.bits)
  );

  console.log(
    'wallet balance of assetB after minting is,',
    await wallet.getBalance(assetIdB.bits)
  );

  const orderbookPredicate = new OrderbookPredicate({ provider: fuelProvider });
  const orderbookPredicateAddress = orderbookPredicate.address;

  // Step 1: Recepient deposits 10 of asset A to the predicate

  await (
    await recepient.transfer(orderbookPredicateAddress, 10, assetIdA.bits)
  ).waitForResult();

  console.log(
    'recepient balance of assetA after deposit',
    await recepient.getBalance(assetIdA.bits)
  );

  console.log(
    'predicate balance of assetA after deposit',
    await orderbookPredicate.getBalance(assetIdA.bits)
  );

  const scriptRequest = new ScriptTransactionRequest({
    gasLimit: 100000,
  });

  const walletCoinsAssetB = (await wallet.getCoins(assetIdB.bits)).coins[0];
  const orderbookPredicateCoin = (
    await orderbookPredicate.getCoins(assetIdA.bits)
  ).coins[0];

  scriptRequest.addCoinInput(walletCoinsAssetB);
  scriptRequest.addCoinInput(orderbookPredicateCoin);

  scriptRequest.outputs = [];
  scriptRequest.addCoinOutput(recepient.address, 10, assetIdB.bits);
  scriptRequest.addCoinOutput(wallet.address, 10, assetIdA.bits);

  console.log('inputs:', scriptRequest.inputs);
  console.log('outputs:', scriptRequest.outputs);

  orderbookPredicate.predicateData = [assetIdB, assetIdA, 9, 0];
  orderbookPredicate.populateTransactionPredicateData(scriptRequest);

  await scriptRequest.estimateAndFund(wallet);

  const result = await (
    await wallet.sendTransaction(scriptRequest, { enableAssetBurn: true })
  ).waitForResult();
  console.log('result:', result.status);

  console.log(
    'predicate balances assetB',
    await orderbookPredicate.getBalance(assetIdB.bits)
  );

  console.log(
    'recepient balance of assetA after minting is,',
    await recepient.getBalance(assetIdB.bits)
  );

  console.log(
    'wallet balance of assetB after minting is,',
    await wallet.getBalance(assetIdA.bits)
  );
});
