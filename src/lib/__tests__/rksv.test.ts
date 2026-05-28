import crypto from 'crypto';
import {
  encryptTurnover,
  buildRksvPayload,
  signPayloadJWS,
  hashJws
} from '../rksv';

describe('RKSV Core Functionalities', () => {
  describe('encryptTurnover (AES-256-CTR)', () => {
    it('should return a base64 encoded string', () => {
      const result = encryptTurnover(1500, 'KASSE1', 'RECEIPT_001', crypto.randomBytes(32).toString('base64'));
      expect(typeof result).toBe('string');
      // Simple base64 regex check
      expect(result).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });

    // NOTE: This test will fail currently as the implementation is a stub.
    // It verifies that different turnovers/receipts yield different encrypted values.
    it('should generate different outputs for different turnovers', () => {
      const key = crypto.randomBytes(32).toString('base64');
      const res1 = encryptTurnover(1500, 'KASSE1', 'RECEIPT_001', key);
      const res2 = encryptTurnover(1600, 'KASSE1', 'RECEIPT_001', key);
      expect(res1).not.toBe(res2);
    });
  });

  describe('buildRksvPayload (Datenerfassungsprotokoll)', () => {
    const mockConfig = { rksv: { kassenID: 'KASSE1' } };
    const mockReceipt = {
      receiptNumber: 'B001',
      date: '2026-05-28T08:34:07Z',
      items: [
        { price: 10, taxRate: '20%' },
        { price: 5, taxRate: '10%' },
        { price: 2, taxRate: '0%' }
      ]
    };
    
    it('should correctly format the payload according to RKSV specifications', () => {
      const payload = buildRksvPayload(mockReceipt, mockConfig, 'PREVHASH123', 'ENCRYPTED-TURNOVER');
      
      // RKSV fields separated by underscore. There are 12 fields defined by RKSV.
      // But notice the first field is _R1-AT1. So if we match fields, let's just 
      // check the string structure or split carefully, but since some stubs have underscores,
      // let's split by '_' and examine the known positions.
      
      const expectedPrefix = '_R1-AT1_KASSE1_B001';
      expect(payload.startsWith(expectedPrefix)).toBe(true);
      
      // We can also extract the date from the 4th field (which starts after the 3rd underscore)
      const parts = payload.split('_');
      expect(parts[1]).toBe('R1-AT1');
      expect(parts[2]).toBe('KASSE1');
      expect(parts[3]).toBe('B001');
      expect(parts[4]).not.toMatch(/Z$/);
      
      expect(parts[5]).toBe('10,00'); // normal
      expect(parts[6]).toBe('5,00');  // erm1
      expect(parts[7]).toBe('0,00');  // erm2 (was 13% but receipt has none)
      expect(parts[8]).toBe('2,00');  // null
      expect(parts[9]).toBe('0,00');  // error
      
      // The rest of the payload depends on stubs that might contain underscores,
      // so we just verify they are present in the resulting string.
      expect(payload).toContain('PREVHASH123');
    });
  });

  describe('signPayloadJWS (ES256)', () => {
    it('should output a correctly formatted JWS string', () => {
      const payload = 'TEST_PAYLOAD';
      const jws = signPayloadJWS(payload);
      
      // JWS consists of 3 parts separated by dots
      const parts = jws.split('.');
      expect(parts.length).toBe(3);
      
      // The header should decode to alg: ES256
      const headerRaw = Buffer.from(parts[0], 'base64url').toString('utf8');
      const header = JSON.parse(headerRaw);
      expect(header.alg).toBe('ES256');
      
      // The payload part should match the base64url of our input payload
      const payloadRaw = Buffer.from(parts[1], 'base64url').toString('utf8');
      expect(payloadRaw).toBe(payload);
    });
  });

  describe('hashJws (Verkettungswert)', () => {
    it('should correctly hash the JWS and return 8 bytes base64', () => {
      const input = 'test';
      // SHA-256 of "test" is 9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
      // First 8 bytes: 9f 86 d0 81 88 4c 7d 65
      // Base64 of that: n4bQgYhMfWU=
      const expectedHashBase64 = 'n4bQgYhMfWU=';
      
      const result = hashJws(input);
      expect(result).toBe(expectedHashBase64);
    });
    
    it('should always return a base64 string of length 12 for 8 bytes', () => {
      const result = hashJws('another_jws_test_string.1234.sig');
      expect(result.length).toBe(12);
      expect(result).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    });
  });
});
