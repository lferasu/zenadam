export const runWithConcurrency = async ({ items = [], concurrency = 1, worker }) => {
  const safeConcurrency = Math.max(1, Number(concurrency) || 1);
  const queue = [...items];
  const workers = Array.from({ length: Math.min(safeConcurrency, queue.length || 1) }, async () => {
    while (queue.length) {
      const next = queue.shift();
      await worker(next);
    }
  });

  await Promise.all(workers);
};
