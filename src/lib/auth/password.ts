import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number, opts: object) => Promise<Buffer>;
const N = 32768;
const R = 8;
const P = 1;
const OPTS = { N, r: R, p: P, maxmem: 128 * N * R * 2 };

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 64, OPTS);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

// Hash fixo usado quando o e-mail não existe, para o tempo de resposta não revelar contas.
const DUMMY = "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$" + Buffer.alloc(64).toString("base64");

export async function verifyPassword(password: string, stored: string | null | undefined) {
  const [alg, n, r, p, salt, hash] = (stored ?? DUMMY).split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const actual = await scrypt(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
    maxmem: 128 * Number(n) * Number(r) * 2,
  });
  return timingSafeEqual(actual, expected) && stored != null;
}

export function passwordProblem(pw: string): string | null {
  if (pw.length < 10) return "Use pelo menos 10 caracteres.";
  if (pw.length > 200) return "Senha longa demais.";
  if (/^(.)\1+$/.test(pw)) return "Senha fraca demais.";
  return null;
}
