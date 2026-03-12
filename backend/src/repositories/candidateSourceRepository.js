import { ObjectId } from 'mongodb';
import { getDb } from '../config/database.js';
import { CANDIDATE_SOURCE_COLLECTION } from '../models/CandidateSource.js';

const getCollection = async () => {
  const db = await getDb();
  return db.collection(CANDIDATE_SOURCE_COLLECTION);
};

export const listCandidateSources = async ({ type, limit = 100, skip = 0 } = {}) => {
  const collection = await getCollection();
  const query = {};

  if (type) {
    query.type = type;
  }

  return collection.find(query).sort({ updatedAt: -1, createdAt: -1 }).skip(skip).limit(limit).toArray();
};

export const findCandidateSourceById = async (id) => {
  const collection = await getCollection();
  return collection.findOne({ _id: new ObjectId(id) });
};

export const findCandidateSourceBySlug = async (slug) => {
  const collection = await getCollection();
  return collection.findOne({ slug });
};

export const findCandidateSourceByBaseUrl = async (baseUrl) => {
  const collection = await getCollection();
  return collection.findOne({ baseUrl });
};

export const findCandidateSourceByEntryUrl = async (entryUrl) => {
  const collection = await getCollection();
  return collection.findOne({ entryUrls: entryUrl });
};

export const createCandidateSource = async (source) => {
  const collection = await getCollection();
  const now = new Date();
  const document = {
    ...source,
    createdAt: now,
    updatedAt: now
  };

  const result = await collection.insertOne(document);
  return collection.findOne({ _id: result.insertedId });
};

export const updateCandidateSourceById = async (id, updates) => {
  const collection = await getCollection();

  return collection.findOneAndUpdate(
    { _id: new ObjectId(id) },
    {
      $set: {
        ...updates,
        updatedAt: new Date()
      }
    },
    { returnDocument: 'after' }
  );
};
