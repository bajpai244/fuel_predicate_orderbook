import express from 'express';
import type { RequestHandler } from 'express';
import { Provider } from 'fuels';
import { WalletPool } from './lib/wallet-pool';
import { createRoutes } from './routes';

if (!process.env.FUEL_PROVIDER_URL) {
  throw new Error('FUEL_PROVIDER_URL is not set');
}

if (!process.env.PRIVATE_KEYS) {
  throw new Error('PRIVATE_KEYS is not set');
}

const provider = new Provider(process.env.FUEL_PROVIDER_URL);

// Create wallet pool with multiple private keys
const privateKeys = process.env.PRIVATE_KEYS.split(',');
const walletPool = new WalletPool(privateKeys, provider);

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Create route handlers
const routes = createRoutes(provider, walletPool);

// Register routes
app.get('/health', routes.healthCheck as RequestHandler);
app.post('/fill-order', routes.fillOrder as RequestHandler);
app.get('/price/:tokenName', routes.getPrice as RequestHandler);
app.post('/mint', routes.mint as RequestHandler);
app.post('/mint-all', routes.mintAll as RequestHandler);

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
