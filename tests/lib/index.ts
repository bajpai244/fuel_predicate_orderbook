import {
  type BN,
  createAssetId,
  ZeroBytes32,
  type WalletUnlocked,
} from 'fuels';
import { type DummyStablecoin, DummyStablecoinFactory } from '../../out';

export const deployStableCoin = async (wallet: WalletUnlocked) => {
  const stableCoinFactor = new DummyStablecoinFactory(wallet);
  const { contractId, waitForTransactionId } = await stableCoinFactor.deploy();

  await waitForTransactionId();

  const assetId = createAssetId(contractId, ZeroBytes32);

  return {
    contractId,
    assetId,
  };
};

export const mintAsset = async ({
  stableCoin,
  amount,
  reciever,
}: {
  stableCoin: DummyStablecoin;
  amount: BN;
  reciever: WalletUnlocked;
}) => {
  const call = stableCoin.functions.mint(
    {
      Address: {
        bits: reciever.address.toB256(),
      },
    },
    ZeroBytes32,
    amount
  );

  call.callParams({ gasLimit: 100000 });

  const callResult = await (await call.call()).waitForResult();

  return callResult;
};
