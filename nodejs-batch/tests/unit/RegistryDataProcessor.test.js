/**
 * RegistryDataProcessor ユニットテスト
 * データ解析ロジックの単体テスト
 */

import RegistryDataProcessor from '../../src/processors/RegistryDataProcessor.js';
import DatabaseManager from '../../src/utils/DatabaseManager.js';

describe('RegistryDataProcessor - データ解析ユニットテスト', () => {
  let processor;
  let mockDbManager;

  beforeEach(() => {
    // モックデータベースマネージャーを作成
    mockDbManager = {
      connection: null,
      connect: async () => {},
      disconnect: async () => {},
    };
    processor = new RegistryDataProcessor(mockDbManager);
  });

  describe('_parseDate()', () => {
    test('正しいYYYYMMDD形式をYYYY-MM-DD形式に変換できる', () => {
      const result = processor._parseDate('20240315');
      expect(result).toBe('2024-03-15');
    });

    test('00000000形式の日付はnullを返す', () => {
      const result = processor._parseDate('00000000');
      expect(result).toBeNull();
    });

    test('空文字列の場合はnullを返す', () => {
      const result = processor._parseDate('');
      expect(result).toBeNull();
    });

    test('undefinedの場合はnullを返す', () => {
      const result = processor._parseDate(undefined);
      expect(result).toBeNull();
    });

    test('異なる形式の日付は処理できない', () => {
      const result = processor._parseDate('2024-03-15');
      expect(result).toBeNull();
    });
  });

  describe('_parseRecord()', () => {
    test('IPv4レコードを正しく解析できる', () => {
      const data = {
        registry: 'apnic',
        country: 'JP',
        type: 'ipv4',
        ip: '1.0.0.0',
        value: 256,
        date: '20240101',
        status: 'allocated',
        extended: null,
      };

      const result = processor._parseRecord(data);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      const firstRecord = result[0];
      expect(firstRecord.registry).toBe('apnic');
      expect(firstRecord.country_code).toBe('JP');
      expect(firstRecord.ip_version).toBe(4);
      expect(firstRecord.ip_address_text).toBe('1.0.0.0');
      expect(firstRecord.allocation_date).toBe('2024-01-01');
      expect(firstRecord.status).toBe('allocated');
      expect(firstRecord).toHaveProperty('netblock_cidr');
      expect(firstRecord).toHaveProperty('prefix_length');
    });

    test('IPv6レコードを正しく解析できる', () => {
      const data = {
        registry: 'ripe',
        country: 'DE',
        type: 'ipv6',
        ip: '2001:db8::',
        value: 32,
        date: '20230615',
        status: 'assigned',
        extended: null,
      };

      const result = processor._parseRecord(data);
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
      
      const record = result[0];
      expect(record.registry).toBe('ripe');
      expect(record.country_code).toBe('DE');
      expect(record.ip_version).toBe(6);
      expect(record.ip_address_text).toBe('2001:db8::');
      expect(record.netblock_cidr).toBe('2001:db8::/32');
      expect(record.prefix_length).toBe(32);
      expect(record.allocation_date).toBe('2023-06-15');
    });

    test('日付が00000000の場合はnullになる', () => {
      const data = {
        registry: 'arin',
        country: 'US',
        type: 'ipv4',
        ip: '8.8.8.0',
        value: 256,
        date: '00000000',
        status: 'allocated',
        extended: null,
      };

      const result = processor._parseRecord(data);
      expect(result[0].allocation_date).toBeNull();
    });

    test('IPv4の場合は複数のCIDRブロックを生成する', () => {
      const data = {
        registry: 'apnic',
        country: 'CN',
        type: 'ipv4',
        ip: '1.0.0.0',
        value: 512, // 256 + 256 = /23 + /24?
        date: '20240101',
        status: 'allocated',
        extended: null,
      };

      const result = processor._parseRecord(data);
      expect(Array.isArray(result)).toBe(true);
      // 512個のIPは複数のCIDRに分割される可能性がある
      expect(result.length).toBeGreaterThan(0);
      
      // すべてのレコードが同じregistry/countryを持つことを確認
      result.forEach(record => {
        expect(record.registry).toBe('apnic');
        expect(record.country_code).toBe('CN');
        expect(record.ip_version).toBe(4);
      });
    });
  });

  describe('_parseData()', () => {
    test('通常のレジストリデータを正しく解析できる', () => {
      const rawData = `# Comments should be ignored
2.1|apnic|20240101|summary|ipv4|ipv6|reserved
apnic|JP|ipv4|1.0.0.0|256|20240101|allocated
apnic|CN|ipv6|2001:db8::|32|20230615|assigned
# Another comment
apnic|KR|ipv4|1.1.0.0|512|20240201|allocated`;

      const result = processor._parseData(rawData, 'apnic', false);
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // IPv4/IPv6の両方が含まれることを確認（flatしたレコード）
      const flatResults = result.flat();
      const hasIPv4 = flatResults.some(r => r.ip_version === 4);
      const hasIPv6 = flatResults.some(r => r.ip_version === 6);
      expect(hasIPv4).toBe(true);
      expect(hasIPv6).toBe(true);
    });

    test('空行とコメント行を無視する', () => {
      const rawData = `
# This is a comment
apnic|JP|ipv4|1.0.0.0|256|20240101|allocated

# Another comment

apnic|CN|ipv4|1.1.0.0|256|20240101|allocated
`;

      const result = processor._parseData(rawData, 'apnic', false);
      expect(result.length).toBeGreaterThan(0);
      
      // 有効なレコードのみが解析されることを確認
      const flatResults = result.flat();
      expect(flatResults.every(r => r.registry === 'apnic')).toBe(true);
    });

    test('サマリー行をスキップする', () => {
      const rawData = `apnic|JP|ipv4|1.0.0.0|256|summary|allocated
apnic|CN|ipv4|1.1.0.0|256|20240101|allocated`;

      const result = processor._parseData(rawData, 'apnic', false);
      const flatResults = result.flat();
      
      // summary行は除外されるべき
      expect(flatResults.every(r => r.allocation_date !== null || r.ip_address_text !== '1.0.0.0')).toBe(true);
    });

    test('不正な形式の行を無視する', () => {
      const rawData = `apnic|JP|ipv4|1.0.0.0|256|20240101|allocated
invalid|line
apnic|CN|ipv4|1.1.0.0|256|20240101|allocated
short|line`;

      const result = processor._parseData(rawData, 'apnic', false);
      expect(result.length).toBeGreaterThan(0);
      
      // 正しい形式の行のみが解析される
      const flatResults = result.flat();
      expect(flatResults.length).toBeGreaterThan(0);
    });

    test('IPv4/IPv6以外のタイプを無視する', () => {
      const rawData = `apnic|JP|asn|12345|1|20240101|allocated
apnic|CN|ipv4|1.0.0.0|256|20240101|allocated
apnic|KR|ipv6|2001:db8::|32|20240101|allocated`;

      const result = processor._parseData(rawData, 'apnic', false);
      const flatResults = result.flat();
      
      // IPv4/IPv6のみが含まれる
      expect(flatResults.every(r => r.ip_version === 4 || r.ip_version === 6)).toBe(true);
    });

    test('テストモードでIPv4の制限が機能する', () => {
      const rawData = `apnic|JP|ipv4|1.0.0.0|256|20240101|allocated
apnic|CN|ipv4|1.1.0.0|256|20240101|allocated
apnic|KR|ipv4|1.2.0.0|256|20240101|allocated
apnic|US|ipv4|1.3.0.0|256|20240101|allocated`;

      const result = processor._parseData(rawData, 'apnic', false, {
        testMode: true,
        ipv4Limit: 2,
        ipv6Limit: 0,
      });

      expect(result.length).toBeLessThanOrEqual(2);
    });

    test('テストモードでIPv6の制限が機能する', () => {
      const rawData = `apnic|JP|ipv6|2001:db8::|32|20240101|allocated
apnic|CN|ipv6|2001:db9::|32|20240101|allocated
apnic|KR|ipv6|2001:dba::|32|20240101|allocated`;

      const result = processor._parseData(rawData, 'apnic', false, {
        testMode: true,
        ipv4Limit: 0,
        ipv6Limit: 1,
      });

      const flatResults = result.flat();
      expect(flatResults.length).toBeLessThanOrEqual(1);
    });

    test('拡張フォーマットフラグがtrueでも基本解析は動作する', () => {
      const rawData = `arin|US|ipv4|8.0.0.0|256|20240101|allocated
arin|CA|ipv6|2001:db8::|32|20240101|assigned`;

      const result = processor._parseData(rawData, 'arin', true);
      expect(result.length).toBeGreaterThan(0);
      
      const flatResults = result.flat();
      expect(flatResults.every(r => r.registry === 'arin')).toBe(true);
    });

    test('空のデータは空配列を返す', () => {
      const result = processor._parseData('', 'apnic', false);
      expect(result).toEqual([]);
    });

    test('コメントのみのデータは空配列を返す', () => {
      const rawData = `# Comment 1
# Comment 2
# Comment 3`;

      const result = processor._parseData(rawData, 'apnic', false);
      expect(result).toEqual([]);
    });
  });

  describe('統合的なデータ解析フロー', () => {
    test('実際のレジストリデータに近い形式を正しく処理できる', () => {
      const rawData = `2.1|apnic|20240101|summary|ipv4|ipv6|asn|reserved
apnic|JP|ipv4|1.0.0.0|256|20240110|allocated
apnic|JP|ipv4|1.0.1.0|512|20240111|allocated
apnic|CN|ipv6|2001:200::|32|20231215|allocated
apnic|KR|ipv4|1.1.0.0|1024|20240115|assigned
apnic|AU|ipv6|2001:db8::|48|20240120|allocated`;

      const result = processor._parseData(rawData, 'apnic', false);
      expect(result.length).toBeGreaterThan(0);
      
      const flatResults = result.flat();
      
      // 全レコードが必要なフィールドを持つことを確認
      flatResults.forEach(record => {
        expect(record).toHaveProperty('registry');
        expect(record).toHaveProperty('country_code');
        expect(record).toHaveProperty('ip_version');
        expect(record).toHaveProperty('ip_address_text');
        expect(record).toHaveProperty('netblock_cidr');
        expect(record).toHaveProperty('prefix_length');
        expect(record).toHaveProperty('allocation_date');
        expect(record).toHaveProperty('status');
      });

      // IPv4とIPv6の両方が含まれる
      const ipv4Records = flatResults.filter(r => r.ip_version === 4);
      const ipv6Records = flatResults.filter(r => r.ip_version === 6);
      expect(ipv4Records.length).toBeGreaterThan(0);
      expect(ipv6Records.length).toBeGreaterThan(0);
    });
  });
});
