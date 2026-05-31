import { encryptTurnover, hashJws, buildRksvPayload } from '../lib/rksv';
import crypto from 'crypto';

async function runTests() {
  console.log("Running RKSV Tests...");
  
  // Test Data from official A-SIT Plus Mustercode / BMF
  // https://github.com/a-sit-plus/at-registrierkassen-mustercode/releases
  
  // AES Key (Base64) - 32 Bytes
  const aesKeyBase64 = "1QH3mJ9o/C4O3/E+wR4u+K/G/uM5/7sR1+s8fO8e79c=";
  const kassenId = "DEMO-KASSA";
  const belegNr = "123456";
  const belegDatum = "2015-11-25T19:20:11";
  
  // Umsatz: 123.45 Euro -> 12345 Cents
  const umsatzCents = 12345;
  
  console.log("\n--- Test 1: Turnover Encryption ---");
  const encryptedTurnover = encryptTurnover(umsatzCents, kassenId, belegNr, aesKeyBase64);
  console.log("Encrypted Turnover:", encryptedTurnover);
  // Expected base64 (without padding? or with padding?) We will see if it matches typical lengths.
  
  // Let's create a test receipt payload
  const mockConfig = {
    rksv: {
      kassenID: kassenId,
      certSerial: "123456789",
      aesKey: aesKeyBase64
    }
  };
  
  const mockReceipt = {
    receiptNumber: belegNr,
    date: belegDatum + "+01:00",
    items: [
      { price: 100, taxRate: '20%' },
      { price: 23.45, taxRate: '10%' }
    ]
  };
  
  const prevHash = "ICAgICAgICAgICg="; // Random base64 hash
  
  console.log("\n--- Test 2: Build Payload ---");
  const payload = buildRksvPayload(mockReceipt, mockConfig, prevHash, encryptedTurnover);
  console.log("Payload:", payload);
  
  // Let's check string formatting
  const parts = payload.split('_');
  console.log("Part count (should be 12):", parts.length);
  console.log("Turnover Base64 valid?", Buffer.from(parts[9], 'base64').toString('base64') === parts[9] || Buffer.from(parts[9]+'=', 'base64').toString('base64').startsWith(parts[9]));
}

runTests().catch(console.error);
