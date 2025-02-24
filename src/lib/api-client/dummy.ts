import type { ApiClient } from './';

// Dummy implementation that returns mock prices
export class DummyApiClient implements ApiClient {
  private mockPrices: Record<string, number> = {
    BTC: 45000,
    ETH: 2500,
    FUEL: 10,
    USDC: 1,
  };

  async getTokenPrice(tokenName: string): Promise<number> {
    const normalizedToken = tokenName.toUpperCase();
    if (normalizedToken in this.mockPrices) {
      return this.mockPrices[normalizedToken];
    }
    throw new Error(`Price not found for token: ${tokenName}`);
  }

  async tokenExists(tokenName: string): Promise<boolean> {
    const normalizedToken = tokenName.toUpperCase();
    return normalizedToken in this.mockPrices;
  }
}
