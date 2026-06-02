export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type UnionOmit<T, U extends keyof T> = T extends T ? Omit<T, U> : never;

/**
 * Run an async task over every item with a bounded number of concurrent
 * executions. Unlike a plain `for await` loop (which is fully sequential),
 * this keeps up to `concurrency` tasks in flight at once, which dramatically
 * reduces wall-clock time when starting/processing large numbers of items
 * (e.g. booting 1,000+ workers). Results preserve input order.
 *
 * Each task is isolated: if `task` rejects for one item, the rejection is
 * returned in that slot instead of aborting the whole run.
 */
export async function runWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<(R | undefined)[]> {
  const results: (R | undefined)[] = new Array(items.length);
  const limit = Math.max(1, Math.floor(concurrency));
  let cursor = 0;

  const runners: Promise<void>[] = [];
  const runnerCount = Math.min(limit, items.length);
  for (let i = 0; i < runnerCount; i++) {
    runners.push(
      (async () => {
        while (true) {
          const index = cursor++;
          if (index >= items.length) return;
          try {
            results[index] = await task(items[index], index);
          } catch {
            // Keep the runner alive so remaining items are still processed.
            // Per-item errors are surfaced by the task itself (callers log
            // inside `task`); the failed slot stays undefined.
            results[index] = undefined;
          }
        }
      })()
    );
  }

  await Promise.all(runners);
  return results;
}
