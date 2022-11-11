export async function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type UnionOmit<T, U extends keyof T> = T extends T ? Omit<T, U> : never;
