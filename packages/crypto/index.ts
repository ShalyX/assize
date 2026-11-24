// SPDX-License-Identifier: Apache-2.0
// Assize — Real WebCrypto E2E Encrypted Bid Opening Envelopes & Opening Receipt Digests
// Zero decryptable ciphertext ever touches the Midnight public ledger; only sha256(envelope)
// is anchored on-chain in deliverOpening().

export interface BidOpeningPayload {
  nullifierHex: string;
  price: string;        // bigint serialized as decimal string (cents)
  bondAmount: string;   // bigint serialized as decimal string (cents)
  firmIdHashHex: string;
  subListHashHex: string;
  bidDocsHashHex: string;
  bidSaltHex: string;
  firmName?: string;    // off-chain adjudicator metadata only (never on-chain)
}

export interface EphemeralAdjudicatorKeypair {
  publicKeySpkiB64: string;
  privateKeyPkcs8B64: string;
  publicKeyFingerprintHex: string; // 32-byte SHA-256 stored in adjudicatorEncPubKey on-chain
}

export interface EncryptedBidEnvelope {
  version: "ASSIZE-ENVELOPE-V1";
  tenderIdHex: string;
  slotIndex: number;
  alg: "RSA-OAEP-256+AES-256-GCM";
  wrappedKeyB64: string;
  ivB64: string;
  ciphertextB64: string;
  envelopeHashHex: string; // 32-byte SHA-256 anchored in openingReceipts[slot]
}

const subtle = globalThis.crypto.subtle;

function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (clean.length % 2 !== 0) throw new Error("Invalid hex length");
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export async function sha256Bytes(data: Uint8Array): Promise<Uint8Array> {
  const buf = new Uint8Array(data).buffer;
  const digest = await subtle.digest("SHA-256", buf);
  return new Uint8Array(digest);
}

/**
 * Generate a per-tender ephemeral RSA-OAEP-256 keypair for the authorized adjudicator.
 * Privacy note (honest boundary): per-tender ephemeral key limits blast radius; no forward
 * secrecy is claimed if the adjudicator's private key leaks, though zero ciphertext is
 * stored on-chain (only SHA-256 receipt digests).
 */
export async function generateEphemeralAdjudicatorKeypair(): Promise<EphemeralAdjudicatorKeypair> {
  const kp = await subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
  const spki = new Uint8Array(await subtle.exportKey("spki", kp.publicKey));
  const pkcs8 = new Uint8Array(await subtle.exportKey("pkcs8", kp.privateKey));
  const fp = await sha256Bytes(spki);
  return {
    publicKeySpkiB64: toBase64(spki),
    privateKeyPkcs8B64: toBase64(pkcs8),
    publicKeyFingerprintHex: toHex(fp),
  };
}

/**
 * Encrypt a bidder's opening payload client-side using hybrid RSA-OAEP-256 + AES-256-GCM
 * and compute the canonical 32-byte envelopeHash anchored on Midnight in deliverOpening().
 */
export async function encryptBidOpening(
  tenderIdHex: string,
  slotIndex: number,
  adjudicatorPublicKeySpkiB64: string,
  payload: BidOpeningPayload
): Promise<EncryptedBidEnvelope> {
  const spkiBytes = fromBase64(adjudicatorPublicKeySpkiB64);
  const rsaPub = await subtle.importKey(
    "spki",
    new Uint8Array(spkiBytes).buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );

  const aesKey = await subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const rawAesKey = new Uint8Array(await subtle.exportKey("raw", aesKey));
  const wrappedKey = new Uint8Array(
    await subtle.encrypt({ name: "RSA-OAEP" }, rsaPub, rawAesKey.buffer)
  );

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const aad = new TextEncoder().encode(`ASSIZE-ENVELOPE-V1:${tenderIdHex}:${slotIndex}`);
  const ciphertext = new Uint8Array(
    await subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: aad },
      aesKey,
      plaintext
    )
  );

  const wrappedKeyB64 = toBase64(wrappedKey);
  const ivB64 = toBase64(iv);
  const ciphertextB64 = toBase64(ciphertext);

  const canonical = new TextEncoder().encode(
    JSON.stringify({
      version: "ASSIZE-ENVELOPE-V1",
      tenderIdHex,
      slotIndex,
      alg: "RSA-OAEP-256+AES-256-GCM",
      wrappedKeyB64,
      ivB64,
      ciphertextB64,
    })
  );
  const envelopeHashHex = toHex(await sha256Bytes(canonical));

  return {
    version: "ASSIZE-ENVELOPE-V1",
    tenderIdHex,
    slotIndex,
    alg: "RSA-OAEP-256+AES-256-GCM",
    wrappedKeyB64,
    ivB64,
    ciphertextB64,
    envelopeHashHex,
  };
}

/**
 * Recompute canonical envelopeHash and verify it matches an on-chain openingReceipts[slot] digest.
 */
export async function verifyEnvelopeDigest(
  envelope: EncryptedBidEnvelope,
  expectedHashHex: string
): Promise<boolean> {
  const canonical = new TextEncoder().encode(
    JSON.stringify({
      version: envelope.version,
      tenderIdHex: envelope.tenderIdHex,
      slotIndex: envelope.slotIndex,
      alg: envelope.alg,
      wrappedKeyB64: envelope.wrappedKeyB64,
      ivB64: envelope.ivB64,
      ciphertextB64: envelope.ciphertextB64,
    })
  );
  const computed = toHex(await sha256Bytes(canonical));
  return computed === expectedHashHex.toLowerCase() && computed === envelope.envelopeHashHex.toLowerCase();
}

/**
 * Decrypt a bidder's encrypted opening envelope using the adjudicator's ephemeral private key.
 * Verifies canonical envelope digest before decryption.
 */
export async function decryptBidOpening(
  envelope: EncryptedBidEnvelope,
  adjudicatorPrivateKeyPkcs8B64: string,
  expectedOnChainReceiptHex?: string
): Promise<BidOpeningPayload> {
  if (expectedOnChainReceiptHex) {
    const ok = await verifyEnvelopeDigest(envelope, expectedOnChainReceiptHex);
    if (!ok) {
      throw new Error("Envelope digest does not match on-chain opening receipt");
    }
  }

  const pkcs8Bytes = fromBase64(adjudicatorPrivateKeyPkcs8B64);
  const rsaPriv = await subtle.importKey(
    "pkcs8",
    new Uint8Array(pkcs8Bytes).buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["decrypt"]
  );

  const wrappedKey = fromBase64(envelope.wrappedKeyB64);
  const rawAes = new Uint8Array(
    await subtle.decrypt({ name: "RSA-OAEP" }, rsaPriv, new Uint8Array(wrappedKey).buffer)
  );
  const aesKey = await subtle.importKey(
    "raw",
    rawAes.buffer,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );

  const iv = fromBase64(envelope.ivB64);
  const ciphertext = fromBase64(envelope.ciphertextB64);
  const aad = new TextEncoder().encode(
    `ASSIZE-ENVELOPE-V1:${envelope.tenderIdHex}:${envelope.slotIndex}`
  );
  const plaintext = new Uint8Array(
    await subtle.decrypt(
      { name: "AES-GCM", iv: new Uint8Array(iv), additionalData: aad },
      aesKey,
      new Uint8Array(ciphertext).buffer
    )
  );
  return JSON.parse(new TextDecoder().decode(plaintext)) as BidOpeningPayload;
}
