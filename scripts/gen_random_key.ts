import { Wallet } from 'fuels';

const main = async () => {
  const wallet = Wallet.generate();

  console.log('private key: ', wallet.privateKey);
  console.log('address: ', wallet.address.toB256());
};

main();
