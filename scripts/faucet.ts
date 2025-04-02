import { bn, Provider, Wallet } from 'fuels';
import axios from 'axios';

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

  // take address from command line argument
  const address = process.argv[2];
  if (!address) {
    throw new Error('ADDRESS is not set');
  }

  // make a call to the /mint endpoint
  const response = await axios.post(`http://localhost:3000/mint-all`, {
    address,
  });

  console.log(response.data);
};

main();
