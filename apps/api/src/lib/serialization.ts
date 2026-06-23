export function bigintToString<T>(value: T): T {
  if (typeof value === "bigint") {
    return value.toString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => bigintToString(item)) as T;
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, bigintToString(entry)]),
    ) as T;
  }

  return value;
}

