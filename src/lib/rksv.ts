import crypto from 'crypto';

/**
 * Encrypts the running turnover counter according to RKSV.
 * Algorithm: AES-256-CTR
 * Key: 32 bytes (base64 decoded from config.rksv.aesKey)
 * IV: Derived from Kassen-ID and Belegnummer.
 */
export function encryptTurnover(turnoverCents: number, kassenId: string, receiptNumber: string, aesKeyBase64: string): string {
  // The turnover is encoded as an 8-byte big-endian buffer
  const turnoverBuffer = Buffer.alloc(8);
  turnoverBuffer.writeBigInt64BE(BigInt(turnoverCents));

  // The IV is the first 16 bytes of the SHA-256 hash of Kassen-ID + Belegnummer
  const ivString = kassenId + receiptNumber;
  const hash = crypto.createHash('sha256').update(ivString, 'utf8').digest();
  const iv = hash.subarray(0, 16);

  const key = Buffer.from(aesKeyBase64, 'base64');

  const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);
  const encrypted = Buffer.concat([cipher.update(turnoverBuffer), cipher.final()]);

  return encrypted.toString('base64');
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

  // RKSV requires the local date/time string without offset: YYYY-MM-DDTHH:mm:ss
  // If receiptData.date is from getCurrentTimezonedDate(), it looks like 2026-05-30T23:04:00+02:00
  const dateFmt = receiptData.date.substring(0, 19);
  const certSerial = config.rksv.certSerial; // Extracted from the A-Trust/Fiskal signature card
  
  if (!certSerial || certSerial === "STUB_CERT_SERIAL") {
    throw new Error('Missing certificate serial number (certSerial) in config.rksv');
  }
  
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
 * Signs the payload using A-Trust HSM Online (a.sign RK HSM) and returns the final JWS string.
 * This is the exact string that goes into the QR Code.
 */
export async function signPayloadJWS(payload: string, config: any): Promise<string> {
  const {
    hsUsername,
    hsPassword,
    hsUrl = 'https://hs-abnahme.a-trust.at/RegistrierkasseMobile/v2'
  } = config.rksv;

  if (!hsUsername || !hsPassword) {
    throw new Error('Missing A-Trust HSM credentials (hsUsername, hsPassword)');
  }

  const url = `${hsUrl}/${hsUsername}/Sign/JWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      password: hsPassword,
      jws_payload: payload
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`A-Trust HSM Error: ${response.status} ${response.statusText} - ${errText}`);
  }

  const result = await response.json();
  
  // A-Trust typically returns {"JWS": "..."} or {"result": "..."}
  if (result && typeof result === 'object') {
    if (result.JWS) return result.JWS;
    if (result.result) return result.result;
  }
  
  if (typeof result === 'string') {
    return result;
  }

  throw new Error(`Unexpected A-Trust HSM response format: ${JSON.stringify(result)}`);
}

/**
 * Hashes the JWS string to be used as the 'previousHash' for the next receipt.
 */
export function hashJws(jwsString: string): string {
  // RKSV requires SHA-256 hash of the JWS string, returning the first 8 bytes base64 encoded.
  const hash = crypto.createHash('sha256').update(jwsString, 'utf8').digest();
  return hash.subarray(0, 8).toString('base64');
}
