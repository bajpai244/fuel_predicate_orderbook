import { bn, Provider, Wallet } from 'fuels';

const main = async () => {
  // Get address from command line argument
  const address = process.argv[2];
  if (!address) {
    console.error('Please provide an address as argument');
    process.exit(1);
  }

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

  // Transfer 1 Eth
  const { status } = await (
    await wallets[0].transfer(address, bn(100000000))
  ).waitForResult();

  if (status !== 'success') {
    console.error('Failed to fund address');
    process.exit(1);
  }

  console.log(`Successfully funded address ${address}`);
};

main().catch(console.error);
