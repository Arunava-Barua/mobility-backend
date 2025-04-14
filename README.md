# Mobility Relayer Backend

A Node.js and TypeScript backend service for relaying transactions between a DeFi protocol on the Sui blockchain and Bitcoin.

## Features

- RESTful API for transaction relaying
- Bitcoin transaction verification using Blockstream API
- Sui blockchain integration for collateral management
- MongoDB database integration for transaction storage
- TypeScript for type safety
- Express.js web framework
- Logging with Winston
- Authentication and authorization
- Rate limiting

## Project Structure

```
mobility-backend/
├── src/
│   ├── config/        # Configuration files
│   ├── controllers/   # Route controllers
│   ├── models/        # Database models
│   ├── middleware/    # Custom middleware
│   ├── routes/        # API routes
│   ├── services/      # Business logic
│   ├── utils/         # Utility functions
│   └── index.ts       # Entry point
├── dist/              # Compiled JavaScript
├── logs/              # Application logs
├── .env               # Environment variables
├── .env.example       # Example environment variables
├── package.json       # Dependencies and scripts
└── tsconfig.json      # TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- MongoDB
- Access to Blockstream Bitcoin API
- Access to Sui blockchain network

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
4. Edit the `.env` file with your configuration:
   - MongoDB connection string
   - Port number
   - JWT secret
   - Sui blockchain configuration
   - Bitcoin API configuration
5. Build the project:
   ```bash
   npm run build
   ```
6. Start the server:
   ```bash
   npm start
   ```

For development:
```bash
npm run dev
```

## API Endpoints

- `POST /api/relayer/transaction` - Submit a transaction
- `POST /api/relayer/deposit` - Process a Bitcoin deposit
- `GET /api/relayer/transaction/:txId` - Get transaction status
- `GET /api/relayer/transactions` - Get all transactions with pagination

## Workflow

1. User connects their Sui and Bitcoin wallets to the frontend
2. Frontend captures the Sui and Bitcoin addresses
3. User makes a Bitcoin deposit from their wallet
4. Frontend captures the Bitcoin transaction hash
5. Frontend sends the transaction data to the backend via `/api/relayer/deposit`
6. Backend verifies the Bitcoin transaction using Blockstream API
7. Backend checks if a collateral object exists for the user on Sui blockchain
8. If no collateral exists, backend creates a new collateral object
9. If collateral exists, backend attests new data to the existing collateral
10. Backend returns transaction status to the frontend

## License

See the LICENSE file for details.