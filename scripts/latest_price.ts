import { HermesClient } from '@pythnetwork/hermes-client';

const main = async () => {
  const connection = new HermesClient('https://hermes.pyth.network', {});

  const fuelPriceId =
    '0x8a757d54e5d34c7ff1aea8502a2d968686027a304d00418092aaf7e60ed98d95';
  const btcPriceId =
    '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43';
  const ethPriceId =
    '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace';

  const priceIds = [fuelPriceId, btcPriceId, ethPriceId];

  // Latest price updates
  const priceUpdates = await connection.getLatestPriceUpdates(priceIds);

  console.log(
    priceUpdates.parsed?.map(({ price }) => {
      return price;
    })
  );
};

main();
