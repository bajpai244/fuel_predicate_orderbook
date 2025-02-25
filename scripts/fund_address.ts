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

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);
  const wallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);

  // Transfer 0.00001 Eth
  const { status } = await (
    await wallet.transfer(address, bn(100000))
  ).waitForResult();

  if (status !== 'success') {
    console.error('Failed to fund address');
    process.exit(1);
  }

  console.log(`Successfully funded address ${address}`);
};

main().catch(console.error);
