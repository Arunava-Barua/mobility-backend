import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  data: any;
  signature: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  hash?: string;
  error?: string;
  suiAddress?: string;
  bitcoinAddress?: string;
  bitcoinTxHash?: string;
  collateralCreated?: boolean;
}

const TransactionSchema: Schema = new Schema({
  data: {
    type: Schema.Types.Mixed,
    required: true
  },
  signature: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  hash: {
    type: String
  },
  error: {
    type: String
  },
  suiAddress: {
    type: String
  },
  bitcoinAddress: {
    type: String
  },
  bitcoinTxHash: {
    type: String
  },
  collateralCreated: {
    type: Boolean,
    default: false
  }
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
