import { DeleteObjectsCommand, GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Armazena apenas blocos já cifrados. Bucket privado; nunca há URL pública do bucket.
export interface BlobStore {
  put(key: string, body: Buffer): Promise<void>;
  get(key: string): Promise<Buffer>;
  list(prefix: string): Promise<string[]>;
  deletePrefix(prefix: string): Promise<void>;
}

export type StorageConfig = {
  STORAGE_DRIVER: "s3" | "fs";
  STORAGE_FS_DIR: string;
  S3_ENDPOINT?: string;
  S3_REGION: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
};

class FsStore implements BlobStore {
  constructor(private root: string) {}
  private file(key: string) {
    const p = path.resolve(this.root, key);
    if (!p.startsWith(path.resolve(this.root) + path.sep)) throw new Error("chave inválida");
    return p;
  }
  async put(key: string, body: Buffer) {
    await mkdir(path.dirname(this.file(key)), { recursive: true });
    await writeFile(this.file(key), body);
  }
  get(key: string) {
    return readFile(this.file(key));
  }
  async list(prefix: string) {
    const out: string[] = [];
    const walk = async (dir: string) => {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await walk(full);
        else out.push(path.relative(this.root, full).split(path.sep).join("/"));
      }
    };
    await walk(path.resolve(this.root));
    return out.filter((k) => k.startsWith(prefix)).sort();
  }
  async deletePrefix(prefix: string) {
    await rm(this.file(prefix.replace(/\/$/, "")), { recursive: true, force: true });
  }
}

class S3Store implements BlobStore {
  private s3: S3Client;
  constructor(private bucket: string, cfg: StorageConfig) {
    this.s3 = new S3Client({
      endpoint: cfg.S3_ENDPOINT,
      region: cfg.S3_REGION,
      forcePathStyle: false,
      credentials: { accessKeyId: cfg.S3_ACCESS_KEY_ID!, secretAccessKey: cfg.S3_SECRET_ACCESS_KEY! },
    });
  }
  async put(key: string, body: Buffer) {
    await this.s3.send(new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: "application/octet-stream" }));
  }
  async get(key: string) {
    const r = await this.s3.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await r.Body!.transformToByteArray());
  }
  async list(prefix: string) {
    const keys: string[] = [];
    let token: string | undefined;
    do {
      const r = await this.s3.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
      for (const o of r.Contents ?? []) if (o.Key) keys.push(o.Key);
      token = r.IsTruncated ? r.NextContinuationToken : undefined;
    } while (token);
    return keys.sort();
  }
  async deletePrefix(prefix: string) {
    const keys = await this.list(prefix);
    for (let i = 0; i < keys.length; i += 1000) {
      await this.s3.send(
        new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys.slice(i, i + 1000).map((Key) => ({ Key })) } }),
      );
    }
  }
}

export function createStore(cfg: StorageConfig, bucket = cfg.S3_BUCKET): BlobStore {
  return cfg.STORAGE_DRIVER === "fs" ? new FsStore(cfg.STORAGE_FS_DIR) : new S3Store(bucket!, cfg);
}

export const chunkKey = (docId: string, index: number) => `docs/${docId}/${String(index).padStart(5, "0")}`;
