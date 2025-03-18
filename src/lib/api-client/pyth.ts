import { HermesClient } from '@pythnetwork/hermes-client';
import type { ApiClient } from './';

export class PythApiClient implements ApiClient {
  connection: HermesClient;

  priceIds = {
    fuel: '0x8a757d54e5d34c7ff1aea8502a2d968686027a304d00418092aaf7e60ed98d95',
    btc: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    eth: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  };

  constructor() {
    this.connection = new HermesClient('https://hermes.pyth.network', {});
  }

  async getTokenPrice(tokenName: string): Promise<number> {
    if (!this.tokenExists(tokenName)) {
      throw new Error(`Token ${tokenName} does not exist`);
    }

    const price = await this.connection.getLatestPriceUpdates([
      this.priceIds[tokenName as keyof typeof this.priceIds],
    ]);

    if (price.parsed?.length) {
      return parseInt(price.parsed[0].price.price);
    }

    throw new Error(`No price found for ${tokenName}`);
  }

  async tokenExists(tokenName: string): Promise<boolean> {
    // @ts-ignore
    return this.priceIds[tokenName] !== undefined;
  }
}
