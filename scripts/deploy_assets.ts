import { writeFileSync } from 'node:fs';

import { Provider, Wallet } from 'fuels';
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

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);
  const wallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);

  const factory = new DummyStablecoinFactory(wallet);

  const usdcAddress = (await (await factory.deploy()).waitForResult()).contract
    .id.b256Address;
  const ethAddress = (await (await factory.deploy()).waitForResult()).contract
    .id.b256Address;
  const btcAddress = (await (await factory.deploy()).waitForResult()).contract
    .id.b256Address;
  const fuelAddress = (await (await factory.deploy()).waitForResult()).contract
    .id.b256Address;

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
