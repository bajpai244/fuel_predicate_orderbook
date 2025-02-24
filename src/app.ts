import express from 'express';
import { ApiClient, DummyApiClient } from './lib';

const app = express();
const port = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

const apiClient = new DummyApiClient();

// Fill order endpoint
app.post('/fill-order', async (req, res) => {
  try {
    const {
      sellTokenName,
      buyTokenName,
      sellTokenAmount,
      buyTokenAmount,
      predicateAddress,
    } = req.body;

    // Validate required fields
    if (
      !sellTokenName ||
      !buyTokenName ||
      !sellTokenAmount ||
      !buyTokenAmount ||
      !predicateAddress
    ) {
      return res.status(400).json({
        error: 'Missing required parameters',
      });
    }

    const sellTokenExists = await apiClient.tokenExists(sellTokenName);
    if (!sellTokenExists) {
      return res.status(400).json({
        error: 'Sell token not found',
      });
    }

    const buyTokenExists = await apiClient.tokenExists(buyTokenName);
    if (!buyTokenExists) {
      return res.status(400).json({
        error: 'Buy token not found',
      });
    }

    // Get current prices for validation
    const sellTokenPrice = await apiClient.getTokenPrice(sellTokenName);
    const buyTokenPrice = await apiClient.getTokenPrice(buyTokenName);

    // Calculate total values
    const sellValue = sellTokenAmount * sellTokenPrice;
    const buyValue = buyTokenAmount * buyTokenPrice;

    console.log('sell value', sellValue);
    console.log('buy value', buyValue);

    // Basic validation of the order
    if (sellValue <= 0 || buyValue <= 0) {
      return res.status(400).json({
        error: 'Invalid token amounts',
      });
    }

    const transactionHash = '0x1234567890abcdef';

    res.status(200).json({
      status: 'success',
      order: {
        sellTokenName,
        buyTokenName,
        sellTokenAmount,
        buyTokenAmount,
        predicateAddress,
        sellValue,
        buyValue,
        transactionHash,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error processing fill order:', error);
    res.status(500).json({
      error: 'Failed to process order',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
