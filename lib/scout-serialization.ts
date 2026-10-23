type Serialized<T> = T extends bigint ? string : T extends Date ? string : T extends Array<infer U> ? Serialized<U>[] : T extends object ? { [K in keyof T]: Serialized<T[K]> } : T;

/** Scout HTTP responses retain exact minor-unit amounts and ISO business dates. */
export function serializeScoutData<T>(value: T): Serialized<T> {
  return JSON.parse(JSON.stringify(value, (_, entry) => typeof entry === "bigint" ? entry.toString() : entry)) as Serialized<T>;
}
