import { createHash, randomBytes, randomUUID } from "node:crypto";

import {
  authNonces as authNoncesTable,
  createDb,
  sessions as sessionsTable,
  users as usersTable,
  wallets as walletsTable,
} from "@bankroll/db";
import { and, eq, gt, isNull } from "drizzle-orm";

export interface AuthNonceRecord {
  walletAddress: string;
  domain: string;
  nonce: string;
  message: string;
  expiresAt: Date;
  consumedAt?: Date;
}

export interface SessionRecord {
  id: string;
  walletAddress: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
}

const memoryAuthNonces = new Map<string, AuthNonceRecord>();
const memorySessions = new Map<string, SessionRecord>();

type DbClient = ReturnType<typeof createDb>["db"];

let cachedDb: DbClient | undefined;

export async function createNonceRecord(walletAddress: string, domain: string) {
  const nonce = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  const message = buildLoginMessage({
    domain,
    walletAddress,
    nonce,
    expiresAt,
  });
  const record: AuthNonceRecord = {
    walletAddress,
    domain,
    nonce,
    message,
    expiresAt,
  };

  const db = getOptionalDb();

  if (db) {
    await db.insert(authNoncesTable).values({
      walletAddress,
      domain,
      nonce,
      message,
      expiresAt,
    });
  } else {
    memoryAuthNonces.set(nonce, record);
  }

  return record;
}

export async function consumeNonce(
  nonce: string,
  walletAddress: string,
  domain: string,
) {
  const db = getOptionalDb();

  if (db) {
    const [record] = await db
      .update(authNoncesTable)
      .set({
        consumedAt: new Date(),
      })
      .where(
        and(
          eq(authNoncesTable.nonce, nonce),
          eq(authNoncesTable.walletAddress, walletAddress),
          eq(authNoncesTable.domain, domain),
          isNull(authNoncesTable.consumedAt),
          gt(authNoncesTable.expiresAt, new Date()),
        ),
      )
      .returning();

    if (!record) {
      throw new Error("Nonce not found, already consumed, or expired");
    }

    return {
      walletAddress: record.walletAddress,
      domain: record.domain,
      nonce: record.nonce,
      message: record.message,
      expiresAt: record.expiresAt,
      consumedAt: record.consumedAt ?? undefined,
    };
  }

  const record = memoryAuthNonces.get(nonce);

  if (!record) {
    throw new Error("Nonce not found");
  }

  if (record.consumedAt) {
    throw new Error("Nonce already consumed");
  }

  if (record.walletAddress !== walletAddress || record.domain !== domain) {
    throw new Error("Nonce context mismatch");
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    throw new Error("Nonce expired");
  }

  record.consumedAt = new Date();
  memoryAuthNonces.set(nonce, record);

  return record;
}

export async function createSession(walletAddress: string) {
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(token);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const db = getOptionalDb();

  if (db) {
    const userWallet = await ensureUserWallet(walletAddress);
    const [session] = await db
      .insert(sessionsTable)
      .values({
        userId: userWallet.userId,
        walletId: userWallet.walletId,
        sessionTokenHash: tokenHash,
        expiresAt,
      })
      .returning();

    if (!session) {
      throw new Error("Failed to create session");
    }

    return {
      record: {
        id: session.id,
        walletAddress,
        tokenHash,
        expiresAt: session.expiresAt,
      },
      token,
    };
  }

  const record: SessionRecord = {
    id: randomUUID(),
    walletAddress,
    tokenHash,
    expiresAt,
  };

  memorySessions.set(record.tokenHash, record);

  return {
    record,
    token,
  };
}

export async function getSession(token: string | undefined) {
  if (!token) {
    return undefined;
  }

  const tokenHash = hashSessionToken(token);
  const db = getOptionalDb();

  if (db) {
    const [session] = await db
      .select({
        id: sessionsTable.id,
        walletAddress: walletsTable.address,
        tokenHash: sessionsTable.sessionTokenHash,
        expiresAt: sessionsTable.expiresAt,
        revokedAt: sessionsTable.revokedAt,
      })
      .from(sessionsTable)
      .innerJoin(walletsTable, eq(sessionsTable.walletId, walletsTable.id))
      .where(
        and(
          eq(sessionsTable.sessionTokenHash, tokenHash),
          isNull(sessionsTable.revokedAt),
          gt(sessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1);

    return session;
  }

  const record = memorySessions.get(tokenHash);

  if (!record || record.revokedAt || record.expiresAt.getTime() <= Date.now()) {
    return undefined;
  }

  return record;
}

export async function revokeSession(token: string | undefined) {
  if (!token) {
    return;
  }

  const tokenHash = hashSessionToken(token);
  const db = getOptionalDb();

  if (db) {
    await db
      .update(sessionsTable)
      .set({
        revokedAt: new Date(),
      })
      .where(eq(sessionsTable.sessionTokenHash, tokenHash));

    return;
  }

  const record = memorySessions.get(tokenHash);

  if (record) {
    record.revokedAt = new Date();
    memorySessions.set(tokenHash, record);
  }
}

export async function ensureUserWallet(walletAddress: string) {
  const db = getRequiredDb();
  const [existing] = await db
    .select({
      userId: walletsTable.userId,
      walletId: walletsTable.id,
    })
    .from(walletsTable)
    .where(eq(walletsTable.address, walletAddress))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [user] = await db
    .insert(usersTable)
    .values({})
    .returning({
      id: usersTable.id,
    });

  if (!user) {
    throw new Error("Failed to create user");
  }

  const [wallet] = await db
    .insert(walletsTable)
    .values({
      userId: user.id,
      address: walletAddress,
      chain: "solana",
      isPrimary: true,
    })
    .returning({
      id: walletsTable.id,
      userId: walletsTable.userId,
    });

  if (!wallet) {
    throw new Error("Failed to create wallet");
  }

  return {
    userId: wallet.userId,
    walletId: wallet.id,
  };
}

export function buildLoginMessage({
  domain,
  walletAddress,
  nonce,
  expiresAt,
}: {
  domain: string;
  walletAddress: string;
  nonce: string;
  expiresAt: Date;
}) {
  return [
    `${domain} wants you to sign in to Bankroll Mafia.`,
    "",
    `Wallet: ${walletAddress}`,
    `Nonce: ${nonce}`,
    `Expires At: ${expiresAt.toISOString()}`,
    "",
    "Only sign this message if you initiated login from Bankroll Mafia.",
  ].join("\n");
}

function hashSessionToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getOptionalDb() {
  if (process.env.NODE_ENV === "test" && !process.env.DATABASE_URL) {
    return undefined;
  }

  return getRequiredDb();
}

function getRequiredDb() {
  if (!cachedDb) {
    cachedDb = createDb().db;
  }

  return cachedDb;
}
