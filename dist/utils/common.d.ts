export declare function wait(ms: number): Promise<void>;
export type UnionOmit<T, U extends keyof T> = T extends T ? Omit<T, U> : never;
