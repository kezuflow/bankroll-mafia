export function utf8Seed(value: string) {
  return new TextEncoder().encode(value);
}

export function uuidSeed(value: string) {
  const normalized = value.replaceAll("-", "");

  if (!/^[0-9a-fA-F]{32}$/.test(normalized)) {
    throw new Error("idempotencyKey must be a UUID");
  }

  const seed = new Uint8Array(16);

  for (let index = 0; index < seed.length; index += 1) {
    seed[index] = Number.parseInt(
      normalized.slice(index * 2, index * 2 + 2),
      16,
    );
  }

  return seed;
}

export function uuidStringFromSeed(seed: Uint8Array) {
  assertFixedBytes("idempotencySeed", seed, 16);
  const hex = Array.from(seed, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");

  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(
    12,
    16,
  )}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function assertFixedBytes(
  name: string,
  value: Uint8Array,
  length: number,
) {
  if (value.length !== length) {
    throw new Error(`${name} must be ${length} bytes`);
  }
}

export function assertBytesEqual(actual: Uint8Array, expected: Uint8Array) {
  if (
    actual.length !== expected.length ||
    actual.some((byte, index) => byte !== expected[index])
  ) {
    throw new Error("Invalid heist account discriminator");
  }
}

export function concatBytes(...chunks: Uint8Array[]) {
  const output = new Uint8Array(
    chunks.reduce((total, chunk) => total + chunk.length, 0),
  );
  let offset = 0;

  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.length;
  }

  return output;
}

export function u64Le(value: bigint) {
  if (value < 0n || value > 18_446_744_073_709_551_615n) {
    throw new Error("u64 value out of range");
  }

  const output = new Uint8Array(8);
  const view = new DataView(output.buffer);
  view.setBigUint64(0, value, true);

  return output;
}

export function readU64Le(value: Uint8Array) {
  assertFixedBytes("u64", value, 8);

  return new DataView(
    value.buffer,
    value.byteOffset,
    value.byteLength,
  ).getBigUint64(0, true);
}
