import { createConfig } from 'fuels';

export default createConfig({
  predicates: [
    "./orderbook_predicate"
  ],
  output: './out',
});

/**
 * Check the docs:
 * https://docs.fuel.network/docs/fuels-ts/fuels-cli/config-file/
 */
