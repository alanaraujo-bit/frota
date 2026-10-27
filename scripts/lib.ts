// Utilidades compartilhadas pelos scripts operacionais (backup, restauração, limpeza).
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { createStore, type StorageConfig } from "../src/lib/storage";

export const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

export function storageConfig(overrides: Partial<StorageConfig> = {}): StorageConfig {
  return {
    STORAGE_DRIVER: (process.env.STORAGE_DRIVER as "s3" | "fs") ?? "s3",
    STORAGE_FS_DIR: process.env.STORAGE_FS_DIR ?? ".storage",
    S3_ENDPOINT: process.env.S3_ENDPOINT,
    S3_REGION: process.env.S3_REGION ?? "auto",
    S3_BUCKET: process.env.S3_BUCKET,
    S3_ACCESS_KEY_ID: process.env.S3_ACCESS_KEY_ID,
    S3_SECRET_ACCESS_KEY: process.env.S3_SECRET_ACCESS_KEY,
    ...overrides,
  };
}

export const appStore = () => createStore(storageConfig());

/** Destino do backup: bucket BACKUP_S3_* (credenciais próprias; cai para S3_* se ausentes) ou pasta local BACKUP_DIR. */
export function backupStore() {
  const e = process.env;
  if (e.BACKUP_S3_BUCKET)
    return createStore(
      storageConfig({
        STORAGE_DRIVER: "s3",
        S3_ENDPOINT: e.BACKUP_S3_ENDPOINT ?? e.S3_ENDPOINT,
        S3_REGION: e.BACKUP_S3_REGION ?? e.S3_REGION ?? "auto",
        S3_ACCESS_KEY_ID: e.BACKUP_S3_ACCESS_KEY_ID ?? e.S3_ACCESS_KEY_ID,
        S3_SECRET_ACCESS_KEY: e.BACKUP_S3_SECRET_ACCESS_KEY ?? e.S3_SECRET_ACCESS_KEY,
      }),
      e.BACKUP_S3_BUCKET,
    );
  return createStore(storageConfig({ STORAGE_DRIVER: "fs", STORAGE_FS_DIR: process.env.BACKUP_DIR ?? "backups" }));
}

/** Ordem respeita as chaves estrangeiras (restauração insere nesta ordem). */
export const TABLES = ["user", "group", "vehicle", "document", "session", "invite", "loginAttempt", "vehicleView", "auditLog"] as const;

export function run(main: () => Promise<void>) {
  main()
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
