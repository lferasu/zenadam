import { MongoClient } from 'mongodb';
import { env } from './env.js';

let mongoClient;
let dbInstance;

export const getMongoClient = async () => {
  if (mongoClient) {
    return mongoClient;
  }

  if (!env.MONGODB_URI) {
    throw new Error('MONGODB_URI is required for database operations.');
  }

  mongoClient = new MongoClient(env.MONGODB_URI, {
    ignoreUndefined: true
  });

  await mongoClient.connect();
  return mongoClient;
};

export const getDb = async () => {
  if (dbInstance) {
    return dbInstance;
  }

  const client = await getMongoClient();
  dbInstance = client.db(env.MONGODB_DB_NAME);
  return dbInstance;
};

export const closeMongoClient = async () => {
  if (!mongoClient) {
    return;
  }

  await mongoClient.close();
  mongoClient = undefined;
  dbInstance = undefined;
};
