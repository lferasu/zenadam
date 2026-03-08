import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import { SOURCE_COLLECTION, SOURCE_STATUS } from '../models/Source.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(SOURCE_COLLECTION);
};

export const findSourceBySlug = async (slug) => {
  const collection = await getCollection();
  return collection.findOne({ slug });
};

export const findActiveSourcesByType = async (type) => {
  const collection = await getCollection();
  const query = { status: SOURCE_STATUS.ACTIVE };

  if (type) {
    query.type = type;
  }

  return collection.find(query).toArray();
};

export const upsertSourceBySlug = async (source) => {
  const collection = await getCollection();
  const now = new Date();

  const result = await collection.findOneAndUpdate(
    { slug: source.slug },
    {
      $set: {
        ...source,
        updatedAt: now
      },
      $setOnInsert: {
        createdAt: now
      }
    },
    {
      upsert: true,
      returnDocument: 'after'
    }
  );

  return result;
};

export const findSourceById = async (id) => {
  const collection = await getCollection();
  return collection.findOne({ _id: new ObjectId(id) });
};
