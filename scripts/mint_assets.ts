import { DummyStablecoin, MultiMintScript } from '../out';
import assets from '../assets.json';
import {
  Address,
  BN,
  bn,
  createAssetId,
  Provider,
  ScriptRequest,
  ScriptTransactionRequest,
  Wallet,
  ZeroBytes32,
} from 'fuels';

// mints assets with 1:10 ratio, for every 1 token minted for user, 10 tokens are minted for the solver
const main = async () => {
  const FUEL_PROVIDER_URL = process.env.FUEL_PROVIDER_URL;
  if (!FUEL_PROVIDER_URL) {
    throw new Error('FUEL_PROVIDER_URL is not set');
  }

  const PRIVATE_KEYS = process.env.PRIVATE_KEYS;
  if (!PRIVATE_KEYS) {
    throw new Error('PRIVATE_KEYS is not set');
  }

  const USER_PRIVATE_KEY = process.env.USER_PRIVATE_KEY;
  if (!USER_PRIVATE_KEY) {
    throw new Error('USER_PRIVATE_KEY is not set');
  }

  const provider = new Provider(FUEL_PROVIDER_URL);
  const privateKeys = PRIVATE_KEYS.split(',');
  const wallets = privateKeys.map((privateKey) =>
    Wallet.fromPrivateKey(privateKey, provider)
  );
  const userAddress = Wallet.fromPrivateKey(USER_PRIVATE_KEY, provider).address;
  const mintAmount = bn(10).pow(9).mul(5000);

  // const usdcAssetId = createAssetId(assets.usdc, ZeroBytes32);
  // const fuelAssetId = createAssetId(assets.fuel, ZeroBytes32);
  // const ethAssetId = createAssetId(assets.eth, ZeroBytes32);
  // const btcAssetId = createAssetId(assets.btc, ZeroBytes32);

  // const multiMintScript = new MultiMintScript(wallet);

  // const scriptRequest = await multiMintScript.functions.main({
  //   usdc_contract_address: assets.usdc,
  //   fuel_contract_address: assets.fuel,
  //   eth_contract_address: assets.eth,
  //   btc_contract_address: assets.btc,
  //   recipient: userAddress.toB256(),
  // }).getTransactionRequest();

  // scriptRequest.addContractInputAndOutput(Address.fromAddressOrString(assets.usdc));
  // scriptRequest.addContractInputAndOutput(Address.fromAddressOrString(assets.fuel));
  // scriptRequest.addContractInputAndOutput(Address.fromAddressOrString(assets.eth));
  // scriptRequest.addContractInputAndOutput(Address.fromAddressOrString(assets.btc));

  // scriptRequest.addVariableOutputs(userAddress, usdcAssetId.bits);
  // scriptRequest.addVariableOutputs(userAddress, fuelAssetId.bits);
  // scriptRequest.addVariableOutputs(userAddress, ethAssetId.bits);
  // scriptRequest.addVariableOutputs(userAddress, btcAssetId.bits);

  // scriptRequest.maxFee = new BN(10000000);
  // scriptRequest.gasLimit = new BN(100000)

  // await provider.estimateTxDependencies(scriptRequest);
  // await scriptRequest.estimateAndFund(wallet);

  // const transactionResult = await (await wallet.sendTransaction(scriptRequest)).waitForResult();

  // console.log('transactionResult', transactionResult.id);
  // console.log('transactionResult', (transactionResult).status);

  // ------------------------------------------------------------

  for (const [tokenName, contractId] of Object.entries(assets)) {
    console.log(`Minting ${tokenName}...`);

    const assetId = createAssetId(contractId, ZeroBytes32);

    console.log(
      'user balance before: ',
      await provider.getBalance(userAddress, assetId.bits)
    );

    for (const wallet of wallets) {
      console.log(
        `solver balance before (${wallet.address.toB256()}): `,
        await provider.getBalance(wallet.address, assetId.bits)
      );
    }

    const stableCoin = new DummyStablecoin(contractId, wallets[0]);

    const userCall = stableCoin.functions.mint(
      {
        Address: {
          bits: userAddress.toB256(),
        },
      },
      ZeroBytes32,
      mintAmount
    );

    const solverCalls = wallets.map((wallet) =>
      stableCoin.functions.mint(
        {
          Address: {
            bits: wallet.address.toB256(),
          },
        },
        ZeroBytes32,
        tokenName === 'fuel' ? new BN(10).pow(18) : mintAmount.mul(200)
      )
    );

    const multiCall = stableCoin.multiCall([userCall, ...solverCalls]);

    const callResult = await (await multiCall.call()).waitForResult();
    console.log('transactionId', callResult.transactionResponse.id);
    console.log(
      'mint status:',
      (await callResult.transactionResponse.waitForResult()).status
    );

    console.log(
      'user balance after: ',
      await provider.getBalance(userAddress, assetId.bits)
    );

    for (const wallet of wallets) {
      console.log(
        `solver balance after (${wallet.address.toB256()}): `,
        await provider.getBalance(wallet.address, assetId.bits)
      );
    }
  }
};

main();
