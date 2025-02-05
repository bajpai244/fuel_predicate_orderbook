import {
  bn,
  Provider,
  ScriptTransactionRequest,
  TransactionStatus,
  Wallet,
  type AssetId,
  type WalletUnlocked,
} from 'fuels';
import { DummyStablecoin, OrderbookPredicate } from '../out/index';
import { describe, test, expect, beforeEach } from 'bun:test';
import { deployStableCoin, mintAsset } from './lib';

type TestContext = {
  wallet: WalletUnlocked;
  recepient: WalletUnlocked;
  orderbookPredicate: OrderbookPredicate;
  assetIdA: AssetId;
  assetIdB: AssetId;
  assetIdC: AssetId;
  stableCoinA: DummyStablecoin;
  stableCoinB: DummyStablecoin;
  stableCoinC: DummyStablecoin;
};

describe('Orderbook Predicate', async () => {
  let textContext: TestContext;

  beforeEach(async () => {
    textContext = await setup();
  });

  test('should pass on fullfillment of the order', async () => {
    const {
      recepient,
      wallet,
      stableCoinA,
      stableCoinB,
      stableCoinC,
      orderbookPredicate,
      assetIdA,
      assetIdB,
    } = textContext;

    const orderbookPredicateAddress = orderbookPredicate.address;

    await mintAsset({
      stableCoin: stableCoinA,
      amount: bn(10),
      reciever: recepient.address,
    });

    await mintAsset({
      stableCoin: stableCoinB,
      amount: bn(10),
      reciever: wallet.address,
    });

    // Minting so that it can be used to signal cancellation of the order
    await mintAsset({
      stableCoin: stableCoinC,
      amount: bn(10),
      reciever: recepient.address,
    });

    // Step 1: Recepient deposits 10 of asset A to the predicate

    await (
      await recepient.transfer(orderbookPredicateAddress, 10, assetIdA.bits)
    ).waitForResult();

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

    orderbookPredicate.predicateData = [
      assetIdB,
      assetIdA,
      9,
      0,
      { bits: recepient.address.toB256() },
      undefined,
    ];
    orderbookPredicate.populateTransactionPredicateData(scriptRequest);

    await scriptRequest.estimateAndFund(wallet);

    expect((await recepient.getBalance(assetIdA.bits)).eq(0)).toBeTrue();
    expect(
      (await orderbookPredicate.getBalance(assetIdA.bits)).eq(10)
    ).toBeTrue();
    expect((await wallet.getBalance(assetIdB.bits)).eq(10)).toBeTrue();

    const result = await (
      await wallet.sendTransaction(scriptRequest, { enableAssetBurn: true })
    ).waitForResult();

    expect(result.status).toBe(TransactionStatus.success);

    expect((await recepient.getBalance(assetIdB.bits)).eq(10)).toBeTrue();
    expect(
      (await orderbookPredicate.getBalance(assetIdA.bits)).eq(0)
    ).toBeTrue();
    expect((await wallet.getBalance(assetIdA.bits)).eq(10)).toBeTrue();
  });

  test('cancellation of the order', async () => {
    const {
      recepient,
      stableCoinA,
      stableCoinC,
      orderbookPredicate,
      assetIdA,
      assetIdB,
      assetIdC,
    } = textContext;

    const orderbookPredicateAddress = orderbookPredicate.address;

    await mintAsset({
      stableCoin: stableCoinA,
      amount: bn(10),
      reciever: recepient.address,
    });

    // Minting so that it can be used to signal cancellation of the order
    await mintAsset({
      stableCoin: stableCoinC,
      amount: bn(10),
      reciever: recepient.address,
    });

    // Step 1: Recepient deposits 10 of asset A to the predicate

    await (
      await recepient.transfer(orderbookPredicateAddress, 10, assetIdA.bits)
    ).waitForResult();

    const scriptRequest = new ScriptTransactionRequest({
      gasLimit: 100000,
    });

    const recepientCoinsAssetC = (await recepient.getCoins(assetIdC.bits))
      .coins[0];

    const orderbookPredicateCoin = (
      await orderbookPredicate.getCoins(assetIdA.bits)
    ).coins[0];

    scriptRequest.addCoinInput(orderbookPredicateCoin);
    scriptRequest.addCoinInput(recepientCoinsAssetC);
    scriptRequest.outputs = [];
    scriptRequest.addCoinOutput(recepient.address, 10, assetIdA.bits);

    orderbookPredicate.predicateData = [
      assetIdB,
      assetIdA,
      9,
      0,
      { bits: recepient.address.toB256() },
      1,
    ];
    orderbookPredicate.populateTransactionPredicateData(scriptRequest);

    await scriptRequest.estimateAndFund(recepient);

    expect((await recepient.getBalance(assetIdA.bits)).eq(0)).toBeTrue();
    expect(
      (await orderbookPredicate.getBalance(assetIdA.bits)).eq(10)
    ).toBeTrue();

    const result = await (
      await recepient.sendTransaction(scriptRequest, { enableAssetBurn: true })
    ).waitForResult();

    expect(result.status).toBe(TransactionStatus.success);

    const recepientBalanceAssetA = await recepient.getBalance(assetIdA.bits);
    const predicateBalanceAssetA = await orderbookPredicate.getBalance(
      assetIdA.bits
    );

    expect(recepientBalanceAssetA.eq(10)).toBeTrue();
    expect(predicateBalanceAssetA.eq(0)).toBeTrue();
  });
});

const setup = async (): Promise<TestContext> => {
  if (!process.env.FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }
  if (!process.env.PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set');
  }

  const fuelProvider = new Provider(process.env.FUEL_PROVIDER_URL);

  const wallet = Wallet.fromPrivateKey(process.env.PRIVATE_KEY, fuelProvider);
  const recepient = Wallet.generate({ provider: fuelProvider });

  const orderbookPredicate = new OrderbookPredicate({ provider: fuelProvider });
  const orderbookPredicateAddress = orderbookPredicate.address;

  // send some eth to recepient
  await (await wallet.transfer(recepient.address, 10000)).waitForResult();

  const { contractId: contractIdAssetA, assetId: assetIdA } =
    await deployStableCoin(wallet);
  const { contractId: contractIdAssetB, assetId: assetIdB } =
    await deployStableCoin(wallet);

  // we use this asset to signal cancellation of the order
  const { contractId: contractIdAssetC, assetId: assetIdC } =
    await deployStableCoin(wallet);

  const stableCoinA = new DummyStablecoin(contractIdAssetA, wallet);
  const stableCoinB = new DummyStablecoin(contractIdAssetB, wallet);
  const stableCoinC = new DummyStablecoin(contractIdAssetC, wallet);

  return {
    wallet,
    recepient,
    orderbookPredicate,
    assetIdA,
    assetIdB,
    assetIdC,
    stableCoinA,
    stableCoinB,
    stableCoinC,
  };
};
