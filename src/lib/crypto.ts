import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// Criptografia na aplicação (Railway Buckets não tem SSE nem versionamento).
// Envelope: cada arquivo tem uma chave de dados aleatória (DEK) cifrada com a chave mestra.
// Cada bloco é AES-256-GCM: [iv 12B][tag 16B][ciphertext], com AAD = "<docId>:<índice>"
// para impedir troca ou reordenação de blocos.

const IV = 12;
const TAG = 16;

function gcmEncrypt(key: Buffer, plain: Buffer, aad: string) {
  const iv = randomBytes(IV);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(Buffer.from(aad));
  const body = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), body]);
}

function gcmDecrypt(key: Buffer, blob: Buffer, aad: string) {
  const d = createDecipheriv("aes-256-gcm", key, blob.subarray(0, IV));
  d.setAAD(Buffer.from(aad));
  d.setAuthTag(blob.subarray(IV, IV + TAG));
  return Buffer.concat([d.update(blob.subarray(IV + TAG)), d.final()]);
}

export function newWrappedKey(masterKey: Buffer, docId: string) {
  const dek = randomBytes(32);
  return gcmEncrypt(masterKey, dek, `dek:${docId}`).toString("base64");
}

export function unwrapKey(masterKey: Buffer, wrapped: string, docId: string) {
  return gcmDecrypt(masterKey, Buffer.from(wrapped, "base64"), `dek:${docId}`);
}

export function encryptChunk(dek: Buffer, docId: string, index: number, plain: Buffer) {
  return gcmEncrypt(dek, plain, `${docId}:${index}`);
}

export function decryptChunk(dek: Buffer, docId: string, index: number, blob: Buffer) {
  return gcmDecrypt(dek, blob, `${docId}:${index}`);
}

export const CHUNK_OVERHEAD = IV + TAG;

export function hmac(secret: string, data: string) {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
