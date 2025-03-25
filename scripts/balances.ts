import { createAssetId, Provider, Wallet, ZeroBytes32 } from 'fuels';
import assets from '../assets.json';

const main = async () => {
  const FUEL_PROVIDER_URL = process.env.FUEL_PROVIDER_URL;
  if (!FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);

  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY is not set');
  }

  const userPrivateKey = process.env.USER_PRIVATE_KEY;
  if (!userPrivateKey) {
    throw new Error('USER_PRIVATE_KEY is not set');
  }

  const wallet = Wallet.fromPrivateKey(privateKey, provider);
  const userWallet = Wallet.fromPrivateKey(userPrivateKey, provider);

  console.log('--------------------------------');
  console.log('solver address: ', wallet.address.toB256());
  console.log('solver balances:');

  for (const asset of Object.keys(assets)) {
    const assetId = createAssetId(
      assets[asset as keyof typeof assets],
      ZeroBytes32
    );
    const balance = await wallet.getBalance(assetId.bits);
    console.log(`${asset}: ${balance}`);
  }

  console.log('base asset balance: ', await wallet.getBalance());

  console.log('--------------------------------');
  console.log('user address: ', userWallet.address.toB256());
  console.log('user balances:');
  for (const asset of Object.keys(assets)) {
    const assetId = createAssetId(
      assets[asset as keyof typeof assets],
      ZeroBytes32
    );
    const balance = await userWallet.getBalance(assetId.bits);
    console.log(`${asset}: ${balance}`);
  }

  console.log('base asset balance: ', await userWallet.getBalance());
};

main();
