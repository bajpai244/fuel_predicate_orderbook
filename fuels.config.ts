import { createConfig } from 'fuels';

export default createConfig({
  predicates: ['./orderbook_predicate'],
  contracts: ['./dummy_stablecoin'],
  output: './out',
});

/**
 * Check the docs:
 * https://docs.fuel.network/docs/fuels-ts/fuels-cli/config-file/
 */
