import { DummyApiClient } from '../src/lib';
import axios from 'axios';

// it sells 1 ETH for market price
const main = async () => {
  const apiClient = new DummyApiClient();

  const sellTokenName = 'ETH';
  const buyTokenName = 'USDC';

  const sellTokenPrice = await apiClient.getTokenPrice(sellTokenName);
  const buyTokenPrice = await apiClient.getTokenPrice(buyTokenName);

  const sellTokenAmount = 1;
  const buyTokenAmount = sellTokenPrice * sellTokenAmount;

  console.log('sell token price', sellTokenPrice);
  console.log('buy token price', buyTokenPrice);

  console.log('sell token amount', sellTokenAmount);
  console.log('buy token amount', buyTokenAmount);

  const predicateAddress = '0x1234567890abcdef';

  axios.post('http://localhost:3000/fill-order', {
    sellTokenName,
    buyTokenName,
    sellTokenAmount,
    buyTokenAmount,
    predicateAddress,
  });
};

main();
