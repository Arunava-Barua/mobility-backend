import mongoose, { Document, Schema } from 'mongoose';

export interface ITransaction extends Document {
  data: any;
  signature: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  createdAt: Date;
  processedAt?: Date;
  hash?: string;
  error?: string;
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
  }
});

export default mongoose.model<ITransaction>('Transaction', TransactionSchema);
