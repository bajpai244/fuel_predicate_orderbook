import { bn, Provider, Wallet } from 'fuels';

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

  const fundingAccount = wallets[0];

  console.log('fundingAccount', fundingAccount.address.toB256());
  console.log('funding account balance', await fundingAccount.getBalance());

  for (const wallet of wallets) {
    console.log('funding', wallet.address.toB256());
    if (!wallet.address.equals(fundingAccount.address)) {
      await (
        await fundingAccount.transfer(wallet.address, bn(10000000))
      ).waitForResult();
    }
  }

  console.log('Funded all solver accounts');
};

main();
