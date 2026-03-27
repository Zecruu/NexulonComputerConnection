import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGO_URL || 'mongodb://localhost:27017/nexulon';
  await mongoose.connect(uri, { dbName: 'nexulon' });
  console.log('[db] Connected to MongoDB');
}
