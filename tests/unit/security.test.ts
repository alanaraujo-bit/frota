import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/auth/password";
import { decryptChunk, encryptChunk, newWrappedKey, unwrapKey } from "@/lib/crypto";
import { safeFileName, sniffMime } from "@/lib/files";

describe("criptografia de arquivos", () => {
  const master = randomBytes(32);
  const wrapped = newWrappedKey(master, "doc-1");
  const dek = unwrapKey(master, wrapped, "doc-1");
  const plain = randomBytes(5000);

  it("cifra e decifra um bloco", () => {
    const blob = encryptChunk(dek, "doc-1", 0, plain);
    expect(blob.includes(plain.subarray(0, 64))).toBe(false);
    expect(decryptChunk(dek, "doc-1", 0, blob).equals(plain)).toBe(true);
  });
  it("rejeita bloco adulterado, trocado de posição ou de documento", () => {
    const blob = encryptChunk(dek, "doc-1", 0, plain);
    const tampered = Buffer.from(blob);
    tampered[40] ^= 1;
    expect(() => decryptChunk(dek, "doc-1", 0, tampered)).toThrow();
    expect(() => decryptChunk(dek, "doc-1", 1, blob)).toThrow();
    expect(() => decryptChunk(dek, "doc-2", 0, blob)).toThrow();
  });
  it("chave de dados não abre com outra chave mestra", () => {
    expect(() => unwrapKey(randomBytes(32), wrapped, "doc-1")).toThrow();
  });
});

describe("validação de arquivo", () => {
  it("reconhece assinaturas reais", () => {
    expect(sniffMime(Buffer.from("%PDF-1.7\n"))).toBe("application/pdf");
    expect(sniffMime(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMime(Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });
  it("recusa HTML/SVG disfarçado", () => {
    expect(sniffMime(Buffer.from("<html><script>"))).toBeNull();
    expect(sniffMime(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
  });
  it("limpa nome de arquivo", () => {
    expect(safeFileName('a"b\\c/d\r\n.pdf')).toBe("a_b_c_d_.pdf");
  });
});

describe("senhas", () => {
  it("hash e verificação", async () => {
    const h = await hashPassword("uma frase longa e boa");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("uma frase longa e boa", h)).toBe(true);
    expect(await verifyPassword("errada", h)).toBe(false);
    expect(await verifyPassword("qualquer", null)).toBe(false);
  });
  it("regras mínimas", () => {
    expect(passwordProblem("curta")).not.toBeNull();
    expect(passwordProblem("aaaaaaaaaaaa")).not.toBeNull();
    expect(passwordProblem("frase-boa-2026")).toBeNull();
  });
});
