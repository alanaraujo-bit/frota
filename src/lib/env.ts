import "server-only";
import { z } from "zod";

const schema = z
  .object({
    DATABASE_URL: z.string().min(1),
    APP_URL: z.url(),
    SESSION_SECRET: z.string().min(32, "SESSION_SECRET precisa de 32+ caracteres"),
    FILE_MASTER_KEY: z
      .string()
      .refine((v) => Buffer.from(v, "base64").length === 32, "FILE_MASTER_KEY deve ter 32 bytes em base64"),
    STORAGE_DRIVER: z.enum(["s3", "fs"]).default("s3"),
    STORAGE_FS_DIR: z.string().default(".storage"),
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default("auto"),
    S3_BUCKET: z.string().optional(),
    S3_ACCESS_KEY_ID: z.string().optional(),
    S3_SECRET_ACCESS_KEY: z.string().optional(),
  })
  .refine(
    (e) => e.STORAGE_DRIVER !== "s3" || (e.S3_ENDPOINT && e.S3_BUCKET && e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY),
    "STORAGE_DRIVER=s3 exige S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY_ID e S3_SECRET_ACCESS_KEY",
  )
  .refine((e) => e.STORAGE_DRIVER !== "fs" || process.env.NODE_ENV !== "production" || process.env.ALLOW_FS_STORAGE === "1",
    "STORAGE_DRIVER=fs não é permitido em produção");

let cached: z.infer<typeof schema> | undefined;

export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}
