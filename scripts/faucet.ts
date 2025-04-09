import { bn, Provider, Wallet } from 'fuels';
import axios from 'axios';

const main = async () => {
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
