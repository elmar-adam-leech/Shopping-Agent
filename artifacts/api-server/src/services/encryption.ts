import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENCODING = "base64" as const;
const PREFIX = "enc:";

function getEncryptionKey(): Buffer | null {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return null;
  const buf = Buffer.from(key, "hex");
  if (buf.length !== 32) {
    console.error("[encryption] ENCRYPTION_KEY must be 64 hex characters (32 bytes). Got", buf.length, "bytes.");
    return null;
  }
  return buf;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not configured. Cannot store API keys without encryption.");
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  const combined = Buffer.concat([iv, tag, encrypted]);
  return PREFIX + combined.toString(ENCODING);
}

export function decrypt(ciphertext: string): string {
  if (!ciphertext.startsWith(PREFIX)) return ciphertext;

  const key = getEncryptionKey();
  if (!key) {
    throw new Error("ENCRYPTION_KEY is not configured. Cannot decrypt API key.");
  }

  const combined = Buffer.from(ciphertext.slice(PREFIX.length), ENCODING);
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString("utf8");
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}
