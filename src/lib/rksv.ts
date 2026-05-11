import crypto from 'crypto';

/**
 * Encrypts the running turnover counter according to RKSV.
 * Algorithm: AES-256-CTR
 * Key: 32 bytes (base64 decoded from config.rksv.aesKey)
 * IV: Derived from Kassen-ID and Belegnummer.
 */
export function encryptTurnover(turnoverCents: number, kassenId: string, receiptNumber: string, aesKeyBase64: string): string {
  // STUB: Real implementation needs to format the turnover as an 8-byte big-endian buffer,
  // derive the 16-byte IV from the receipt ID string via SHA-256, and encrypt it.
  // For now, we return a dummy base64 string to satisfy the payload structure.
  return Buffer.from(`ENCRYPTED_${turnoverCents}`).toString('base64');
}

/**
 * Builds the RKSV Data Representation (Datenerfassungsprotokoll / QR-Code Payload)
 * Format: _R1-AT1_Kassen-ID_Belegnummer_Datum-Uhrzeit_Betrag-Satz-Normal_Betrag-Satz-Ermaessigt1_Betrag-Satz-Ermaessigt2_Betrag-Satz-Null_Betrag-Fehler_Zertifikat-Seriennummer_Verkettungswert
 */
export function buildRksvPayload(receiptData: any, config: any, previousHash: string, encryptedTurnover: string): string {
  // Aggregate taxes for the payload
  const taxes = { normal: 0, erm1: 0, erm2: 0, null: 0 };
  receiptData.items.forEach((item: any) => {
    if (item.taxRate === '20%') taxes.normal += item.price;
    else if (item.taxRate === '10%') taxes.erm1 += item.price;
    else if (item.taxRate === '13%') taxes.erm2 += item.price;
    else if (item.taxRate === '0%') taxes.null += item.price;
  });

  const dateFmt = new Date(receiptData.date).toISOString().replace(/Z$/, ''); // Needs specific RKSV format
  const certSerial = "STUB_CERT_SERIAL"; // Extracted from the A-Trust/Fiskal signature card
  
  // RKSV fields separated by underscore
  const payload = [
    '_R1-AT1', // RKSV Version 1, AT Algorithm 1 (ES256)
    config.rksv.kassenID,
    receiptData.receiptNumber,
    dateFmt,
    taxes.normal.toFixed(2).replace('.', ','),
    taxes.erm1.toFixed(2).replace('.', ','),
    taxes.erm2.toFixed(2).replace('.', ','),
    taxes.null.toFixed(2).replace('.', ','),
    '0,00', // Besonderer Steuersatz (usually 0)
    encryptedTurnover,
    certSerial,
    previousHash
  ].join('_');

  return payload;
}

/**
 * Signs the payload using ECDSA (P-256) and SHA-256 (ES256) and returns the final JWS string.
 * This is the exact string that goes into the QR Code.
 */
export function signPayloadJWS(payload: string): string {
  // STUB: This is where we would interface with an A-Trust SmartCard or Fiskaly API 
  // to sign the payload and wrap it in a JWS (JSON Web Signature) format.
  // Format: Base64Url(Header) + '.' + Base64Url(Payload) + '.' + Base64Url(Signature)
  
  const header = Buffer.from(JSON.stringify({ alg: "ES256" })).toString('base64url');
  const b64Payload = Buffer.from(payload).toString('base64url');
  const dummySignature = Buffer.from("STUB_SIGNATURE").toString('base64url');
  
  return `${header}.${b64Payload}.${dummySignature}`;
}

/**
 * Hashes the JWS string to be used as the 'previousHash' for the next receipt.
 */
export function hashJws(jwsString: string): string {
  // RKSV requires SHA-256 hash of the JWS string, returning the first 8 bytes base64 encoded.
  const hash = crypto.createHash('sha256').update(jwsString, 'utf8').digest();
  return hash.subarray(0, 8).toString('base64');
}
