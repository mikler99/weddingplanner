import crypto from "crypto";

// App-level AES-256-GCM for secrets we must persist but never expose (the Plaid
// access token). Key = PLAID_ENCRYPTION_KEY, a 64-char hex string (32 bytes),
// server-only. Ciphertext format: base64(iv):base64(tag):base64(data).
function key(): Buffer {
  const hex = process.env.PLAID_ENCRYPTION_KEY;
  if (!hex || hex.length < 64) throw new Error("PLAID_ENCRYPTION_KEY is missing or too short (need 64 hex chars).");
  return Buffer.from(hex.slice(0, 64), "hex");
}

export function encryptSecret(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function decryptSecret(blob: string): string {
  const [iv, tag, data] = blob.split(":").map((s) => Buffer.from(s, "base64"));
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
