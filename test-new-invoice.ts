import { getConfig } from './src/lib/config';
import { readDb } from './src/lib/db';
import { encryptTurnover, buildRksvPayload, signPayloadJWS, hashJws } from './src/lib/rksv';
import { getCurrentTimezonedDate } from './src/lib/date';
import crypto from 'crypto';

async function run() {
  const config = getConfig();
  const db = await readDb();
  
  const receiptNumber = `INV-TEST-${Date.now()}`;
  const totalAmount = 100; // 100 EUR
  
  const newTurnoverCents = Math.round((db.currentTurnover + totalAmount) * 100);
  const dateStr = getCurrentTimezonedDate();
  const dateFmt = dateStr.substring(0, 19);
  
  const encryptedTurnover = encryptTurnover(newTurnoverCents, config.rksv.kassenID, receiptNumber, config.rksv.aesKey);
  
  let previousHash = db.lastReceiptHash;
  if (!previousHash) {
    const hash = crypto.createHash('sha256').update(config.rksv.kassenID, 'utf8').digest();
    previousHash = hash.subarray(0, 8).toString('base64');
  }
  
  const items = [{ name: 'Test', price: 100, taxRate: '10%' }];
  const rksvPayload = buildRksvPayload({ receiptNumber, date: dateStr, items }, config, previousHash, encryptedTurnover);
  
  console.log("--- RKSV Payload ---");
  console.log(rksvPayload);
  
  try {
    const jwsString = await signPayloadJWS(rksvPayload, config);
    console.log("--- JWS Signature ---");
    console.log(jwsString);
    console.log("--- New Hash ---");
    console.log(hashJws(jwsString));
  } catch (err) {
    console.error("Signing failed:", err);
  }
}
run();
