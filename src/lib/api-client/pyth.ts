import { HermesClient } from '@pythnetwork/hermes-client';
import type { ApiClient } from './';

export class PythApiClient implements ApiClient {
  connection: HermesClient;

  priceIds = {
    fuel: '0x8a757d54e5d34c7ff1aea8502a2d968686027a304d00418092aaf7e60ed98d95',
    btc: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    eth: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    usdc: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  };

  prices = {
    fuel: 0,
    btc: 0,
    eth: 0,
    usdc: 0,
  };

  constructor() {
    this.connection = new HermesClient('https://hermes.pyth.network', {});

    const setTimeouts = async () => {
      setTimeout(async () => {
        console.log('refreshing prices');

        const keys = Object.keys(this.priceIds);
        for (const key of keys) {
          const priceId = this.priceIds[key as keyof typeof this.priceIds];

          const price = await this.connection.getLatestPriceUpdates([priceId]);

          if (price.parsed?.length) {
            const assetPrice =
              Number.parseInt(price.parsed[0].price.price) / 10 ** 8;
            this.prices[key as keyof typeof this.prices] = assetPrice;
          }
        }
      }, 5 * 1000);
    };

    setTimeouts();
  }

  async getTokenPrice(_tokenName: string): Promise<number> {
    const tokenName = _tokenName.toLowerCase();
    console.log('tokenName', tokenName);

    if (!this.tokenExists(tokenName)) {
      throw new Error(`Token ${tokenName} does not exist`);
    }

    return this.prices[tokenName as keyof typeof this.prices];
  }

  async tokenExists(tokenName: string): Promise<boolean> {
    // @ts-ignore
    return this.priceIds[tokenName] !== undefined;
  }
}
