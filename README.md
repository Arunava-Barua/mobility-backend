# Mobility Relayer Backend

A Node.js and TypeScript backend service for relaying transactions in a mobility system.

## Features

- RESTful API for transaction relaying
- MongoDB database integration
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
4. Edit the `.env` file with your configuration
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
- `GET /api/relayer/transaction/:txId` - Get transaction status
- `GET /api/relayer/transactions` - Get all transactions with pagination

## License

See the LICENSE file for details.