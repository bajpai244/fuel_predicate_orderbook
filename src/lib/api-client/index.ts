import type { BN } from 'fuels';

export interface ApiClient {
  getTokenPrice(tokenName: string): Promise<number>;
  tokenExists(tokenName: string): Promise<boolean>;
}

export * from './dummy';
export * from './pyth';
