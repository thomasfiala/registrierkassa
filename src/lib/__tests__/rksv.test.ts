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

  describe('signPayloadJWS (A-Trust HSM Online)', () => {
    const mockConfig = {
      rksv: {
        hsUsername: 'u123456789',
        hsPassword: 'test-password',
        hsUrl: 'https://hs-abnahme.a-trust.at/RegistrierkasseMobile/v2'
      }
    };

    beforeEach(() => {
      global.fetch = jest.fn() as jest.Mock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should successfully post to A-Trust and return JWS', async () => {
      const mockJwsResponse = { JWS: 'eyJhbGciOiJFUzI1NiJ9.dGVzdA.c2lnbmF0dXJl' };
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockJwsResponse)
      });

      const payload = 'TEST_PAYLOAD';
      const jws = await signPayloadJWS(payload, mockConfig);
      
      expect(global.fetch).toHaveBeenCalledWith(
        'https://hs-abnahme.a-trust.at/RegistrierkasseMobile/v2/u123456789/Sign/JWS',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: 'test-password', jws_payload: payload })
        })
      );
      expect(jws).toBe(mockJwsResponse.JWS);
    });

    it('should throw an error when A-Trust API fails', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid credentials')
      });

      await expect(signPayloadJWS('TEST_PAYLOAD', mockConfig)).rejects.toThrow('A-Trust HSM Error: 401 Unauthorized - Invalid credentials');
    });

    it('should throw an error if credentials are missing', async () => {
      await expect(signPayloadJWS('TEST_PAYLOAD', { rksv: {} })).rejects.toThrow('Missing A-Trust HSM credentials');
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
