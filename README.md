# Mobility Relayer Backend

A Node.js and TypeScript backend service for relaying transactions between a DeFi protocol on the Sui blockchain and Bitcoin.

## Features

- RESTful API for transaction relaying
- Bitcoin transaction verification using Blockstream API
- Sui blockchain integration for collateral management
- MongoDB database integration for transaction storage
- TypeScript for type safety
- Express.js web framework
- Comprehensive logging with Winston
- Input validation with Joi
- Error handling middleware
- Rate limiting

## Project Structure

```
mobility-backend/
├── src/
│   ├── config/        # Configuration files
│   ├── controllers/   # Route controllers
│   ├── models/        # Database models
│   ├── middleware/    # Custom middleware
│   │   └── validators/ # Request validation schemas
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

- Node.js (v16 or higher)
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
   - Sui blockchain configuration:
     - `RELAYER_PRIVATE_KEY`: The private key for the relayer account
     - `RELAYER_REGISTRY_ID`: The object ID of the relayer registry on Sui
     - `WITNESS_REGISTRY_ID`: The object ID of the witness registry on Sui
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

### Submit Transaction
- **Endpoint**: `POST /api/relayer/transaction`
- **Description**: Submit a transaction to be relayed
- **Request Body**:
  ```json
  {
    "transaction": { /* Transaction data */ },
    "signature": "..."
  }
  ```

### Process Bitcoin Deposit
- **Endpoint**: `POST /api/relayer/deposit`
- **Description**: Process a Bitcoin deposit
- **Request Body**:
  ```json
  {
    "suiAddress": "0x...",
    "bitcoinAddress": "...",
    "bitcoinTxHash": "..."
  }
  ```

### Get Transaction Status
- **Endpoint**: `GET /api/relayer/transaction/:txId`
- **Description**: Get status of a specific transaction

### List Transactions
- **Endpoint**: `GET /api/relayer/transactions?page=1&limit=10`
- **Description**: Get a paginated list of transactions

## Workflow

1. User connects their Sui and Bitcoin wallets to the frontend
2. Frontend captures the Sui and Bitcoin addresses
3. User makes a Bitcoin deposit from their wallet
4. Frontend captures the Bitcoin transaction hash
5. Frontend sends the transaction data to the backend via `/api/relayer/deposit`
6. Backend verifies the Bitcoin transaction using Blockstream API:
   - Checks if transaction exists and is confirmed
   - Ensures transaction has the minimum required confirmations (default: 2)
7. Backend checks if a collateral object exists for the user on Sui blockchain using the Sui SDK
8. If no collateral exists, backend creates a new collateral object:
   - Creates a collateral proof object for the user
   - Attests the Bitcoin transaction data to the new collateral
9. If collateral exists, backend attests new data to the existing collateral:
   - Retrieves the existing collateral proof object
   - Attests the Bitcoin transaction data to it
10. Backend returns transaction status and details to the frontend

## Health Check

- **Endpoint**: `GET /health`
- **Description**: Simple health check to verify the service is running

## Error Handling

The application includes comprehensive error handling:
- Input validation errors with detailed messages
- Transaction processing errors with proper status codes
- Global error handling for unexpected errors
- Logging of all errors with stack traces in development

## Sui Blockchain Integration

The service integrates with the Sui blockchain using:
- `@mysten/sui` SDK for transactions and queries
- Custom Move modules for collateral management:
  - `create_collateral_proof`: Creates a new collateral proof object
  - `attest_btc_deposit`: Attests Bitcoin deposit data to a collateral proof

## License

See the LICENSE file for details.