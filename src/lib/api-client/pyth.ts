import { HermesClient } from '@pythnetwork/hermes-client';
import type { ApiClient } from './';
import { BN } from 'fuels';

export class PythApiClient implements ApiClient {
  connection: HermesClient;

  priceIds = {
    fuel: '0x8a757d54e5d34c7ff1aea8502a2d968686027a304d00418092aaf7e60ed98d95',
    btc: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    eth: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    usdc: '0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  };

  constructor() {
    this.connection = new HermesClient('https://hermes.pyth.network', {});
  }

  async getTokenPrice(tokenName: string): Promise<number> {
    tokenName = tokenName.toLowerCase();
    console.log('tokenName', tokenName);

    if (!this.tokenExists(tokenName)) {
      throw new Error(`Token ${tokenName} does not exist`);
    }

    const priceId = this.priceIds[tokenName as keyof typeof this.priceIds];

    console.log('priceId', priceId);

    const price = await this.connection.getLatestPriceUpdates([priceId]);

    if (price.parsed?.length) {
      console.log('price', price.parsed[0].price.price);
      // since pyth price is 8 decimals
      return parseInt(price.parsed[0].price.price) / 10 ** 8;
    }

    throw new Error(`No price found for ${tokenName}`);
  }

  async tokenExists(tokenName: string): Promise<boolean> {
    // @ts-ignore
    return this.priceIds[tokenName] !== undefined;
  }
}
