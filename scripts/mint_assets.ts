import { DummyStablecoin } from '../out';
import assets from '../assets.json';
import { bn, createAssetId, Provider, Wallet, ZeroBytes32 } from 'fuels';

// mints assets with 1:10 ratio, for every 1 token minted for user, 10 tokens are minted for the solver
const main = async () => {
  const FUEL_PROVIDER_URL = process.env.FUEL_PROVIDER_URL;
  if (!FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }

  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  if (!PRIVATE_KEY) {
    throw new Error('PRIVATE_KEY is not set');
  }

  const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;
  if (!USER_PRIVATE_KEY) {
    throw new Error('USER_PRIVATE_KEY is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);
  const wallet = Wallet.fromPrivateKey(PRIVATE_KEY, provider);

  const userAddress = Wallet.fromPrivateKey(USER_PRIVATE_KEY, provider).address;
  const mintAmount = bn(1000);

  for (const [tokenName, contractId] of Object.entries(assets)) {
    console.log(`Minting ${tokenName}...`);

    const assetId = createAssetId(contractId, ZeroBytes32);

    console.log(
      'user balance before: ',
      await provider.getBalance(userAddress, assetId.bits)
    );
    console.log(
      'solver balance before: ',
      await provider.getBalance(wallet.address, assetId.bits)
    );

    const stableCoin = new DummyStablecoin(contractId, wallet);

    const userCall = stableCoin.functions.mint(
      {
        Address: {
          bits: userAddress.toB256(),
        },
      },
      ZeroBytes32,
      mintAmount
    );

    const solverCall = stableCoin.functions.mint(
      {
        Address: {
          bits: wallet.address.toB256(),
        },
      },
      ZeroBytes32,
      mintAmount.mul(10)
    );

    const multiCall = stableCoin.multiCall([userCall, solverCall]);

    const callResult = await (await multiCall.call()).waitForResult();
    console.log(
      'mint status:',
      (await callResult.transactionResponse.waitForResult()).status
    );

    console.log(
      'user balance after: ',
      await provider.getBalance(userAddress, assetId.bits)
    );
    console.log(
      'solver balance after: ',
      await provider.getBalance(wallet.address, assetId.bits)
    );
  }
};

main();
