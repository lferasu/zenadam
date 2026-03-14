import { closeMongoClient, getDb } from '../src/config/database.js';
import { CANDIDATE_SOURCE_COLLECTION } from '../src/models/CandidateSource.js';
import { SOURCE_COLLECTION } from '../src/models/Source.js';
import { inferSourceQuality } from '../src/ranking/sourceQualityPolicy.js';

const shouldIncludeCandidates = process.argv.includes('--include-candidates');

const backfillCollection = async ({ collectionName, sourceSet }) => {
  const db = await getDb();
  const collection = db.collection(collectionName);
  const items = await collection.find({}).toArray();

  let updatedCount = 0;

  for (const item of items) {
    const sourceQuality = inferSourceQuality({
      source: item,
      sourceSet,
      existingQuality: item.sourceQuality
    });

    await collection.updateOne(
      { _id: item._id },
      {
        $set: {
          sourceQuality,
          updatedAt: new Date()
        }
      }
    );
    updatedCount += 1;
  }

  return {
    collectionName,
    updatedCount
  };
};

const main = async () => {
  const results = [];
  results.push(await backfillCollection({ collectionName: SOURCE_COLLECTION, sourceSet: 'sources' }));

  if (shouldIncludeCandidates) {
    results.push(
      await backfillCollection({
        collectionName: CANDIDATE_SOURCE_COLLECTION,
        sourceSet: 'candidate_sources'
      })
    );
  }

  console.log(JSON.stringify({ ok: true, results }, null, 2));
  await closeMongoClient();
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
