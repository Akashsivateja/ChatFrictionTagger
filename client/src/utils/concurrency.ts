/**
 * Executes an async worker across items with a bounded concurrency limit.
 * Results settle independently in any order as workers complete.
 */
export async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  worker: (item: T, itemIndex: number) => Promise<void>
): Promise<void> {
  if (items.length === 0) return;

  const safeLimit = Math.max(1, Math.min(limit, items.length));
  let cursor = 0;

  async function next(): Promise<void> {
    while (cursor < items.length) {
      const currentIndex = cursor;
      cursor += 1;
      await worker(items[currentIndex], currentIndex);
    }
  }

  const workers = Array.from({ length: safeLimit }, () => next());
  await Promise.all(workers);
}
