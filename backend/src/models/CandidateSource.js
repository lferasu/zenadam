export const CANDIDATE_SOURCE_COLLECTION = 'candidate_sources';

export const CANDIDATE_SOURCE_STATUS = {
  CANDIDATE: 'candidate'
};

export const createCandidateSourceIndexes = async (db) => {
  const collection = db.collection(CANDIDATE_SOURCE_COLLECTION);

  await Promise.all([
    collection.createIndex({ slug: 1 }, { unique: true }),
    collection.createIndex({ updatedAt: -1, createdAt: -1 })
  ]);
};
