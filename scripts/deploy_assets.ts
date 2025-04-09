import { writeFileSync } from 'node:fs';

import {
  BN,
  createAssetId,
  MultiCallInvocationScope,
  Provider,
  Wallet,
  ZeroBytes32,
} from 'fuels';
import { DummyStablecoinFactory } from '../out';

// The script deploys the following assets:
// - ETH
// - BTC
// - FUEL
// - USDC
const main = async () => {
  const FUEL_PROVIDER_URL = process.env.FUEL_PROVIDER_URL;
  if (!FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }

  const PRIVATE_KEYS = process.env.PRIVATE_KEYS;
  if (!PRIVATE_KEYS) {
    throw new Error('PRIVATE_KEYS is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);
  const wallets = PRIVATE_KEYS.split(',').map((privateKey) =>
    Wallet.fromPrivateKey(privateKey, provider)
  );

  const factory = new DummyStablecoinFactory(wallets[0]);

  const usdc = await (await factory.deploy()).waitForResult();
  const eth = await (await factory.deploy()).waitForResult();
  const btc = await (await factory.deploy()).waitForResult();
  const fuel = await (await factory.deploy()).waitForResult();

  const usdcAddress = usdc.contract.id.b256Address;
  const ethAddress = eth.contract.id.b256Address;
  const btcAddress = btc.contract.id.b256Address;
  const fuelAddress = fuel.contract.id.b256Address;

  const usdcAssetId = createAssetId(usdcAddress, ZeroBytes32);
  await (
    await usdc.contract.functions
      .set_src20_data(usdcAssetId, new BN('0'), 'USDC', 'USDC', 9)
      .call()
  ).waitForResult();

  const ethAssetId = createAssetId(ethAddress, ZeroBytes32);
  await (
    await eth.contract.functions
      .set_src20_data(ethAssetId, new BN('0'), 'ETH', 'ETH', 9)
      .call()
  ).waitForResult();

  const btcAssetId = createAssetId(btcAddress, ZeroBytes32);
  await (
    await btc.contract.functions
      .set_src20_data(btcAssetId, new BN('0'), 'BTC', 'BTC', 9)
      .call()
  ).waitForResult();

  const fuelAssetId = createAssetId(fuelAddress, ZeroBytes32);
  await (
    await fuel.contract.functions
      .set_src20_data(fuelAssetId, new BN('0'), 'FUEL', 'FUEL', 9)
      .call()
  ).waitForResult();

  console.log('USDC: ', usdcAddress);
  console.log('ETH: ', ethAddress);
  console.log('BTC: ', btcAddress);
  console.log('FUEL: ', fuelAddress);

  writeFileSync(
    'assets.json',
    JSON.stringify(
      {
        usdc: usdcAddress,
        eth: ethAddress,
        btc: btcAddress,
        fuel: fuelAddress,
      },
      null,
      2
    )
  );
};

main();
