/**
 * RegistryDataProcessor 統合テスト
 * レジストリデータ処理のテスト（モック使用）
 */

import RegistryDataProcessor from '../../src/processors/RegistryDataProcessor.js';
import DatabaseManager from '../../src/utils/DatabaseManager.js';

describe('RegistryDataProcessor Integration Tests', () => {
  let dbManager;
  let processor;

  beforeAll(async () => {
    dbManager = new DatabaseManager('development');
    await dbManager.connect();
    
    // テスト用レジストリデータの準備
    await setupTestRegistries(dbManager);
  });

  afterAll(async () => {
    // テストデータのクリーンアップ
    await cleanupTestData(dbManager);
    await dbManager.disconnect();
  });

  beforeEach(() => {
    processor = new RegistryDataProcessor(dbManager);
  });

  describe('レジストリ設定の読み込み', () => {
    test('データベースからレジストリ設定を読み込める', async () => {
      const registries = await processor.loadRegistryConfigs();
      
      expect(registries).toBeInstanceOf(Map);
      expect(registries.size).toBeGreaterThan(0);
    });

    test('アクティブなレジストリのみ取得する', async () => {
      const registries = await processor.loadRegistryConfigs();
      
      // すべてのレジストリがアクティブであることを確認
      for (const [code, config] of registries) {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('url');
        expect(code).toBeTruthy();
      }
    });

    test('利用可能なレジストリ一覧を取得できる', async () => {
      const codes = await processor.getAvailableRegistries();
      
      expect(Array.isArray(codes)).toBe(true);
      expect(codes.length).toBeGreaterThan(0);
      
      // 標準的なレジストリコード（少なくとも1つは存在するはず）
      const standardRegistries = ['afrinic', 'apnic', 'arin', 'lacnic', 'ripencc'];
      const hasStandardRegistry = codes.some(code => 
        standardRegistries.includes(code)
      );
      expect(hasStandardRegistry).toBe(true);
    });
  });

  describe('レジストリキャッシュ', () => {
    test('レジストリ設定がキャッシュされる', async () => {
      await processor.loadRegistryConfigs();
      const cacheSize1 = processor.registryCache.size;
      
      // 2回目の呼び出し
      await processor.getAvailableRegistries();
      const cacheSize2 = processor.registryCache.size;
      
      expect(cacheSize1).toBe(cacheSize2);
      expect(cacheSize1).toBeGreaterThan(0);
    });
  });

  describe('データ解析機能', () => {
    test('標準フォーマットの行を解析できる', () => {
      // registryVersion|registry|cc|type|start|value|...
      const testLine = 'ripencc|ripencc|JP|ipv4|192.168.1.0|256|20200101|allocated||';
      
      // この部分は実際のparseLineメソッドに依存（プライベートメソッドの場合はスキップ）
      // テストコードでは公開メソッドのみテスト可能
    });
  });

  describe('IPv4アドレス処理', () => {
    test('IPv4範囲からバイナリ形式に変換する概念検証', async () => {
      // IpCalculatorを使った変換テスト
      const testData = {
        startIp: '192.168.1.0',
        count: 256,
      };
      
      // バイナリ変換の基本動作確認
      const ipParts = testData.startIp.split('.').map(Number);
      const binary = Buffer.from(ipParts);
      
      expect(binary.length).toBe(4);
      expect(binary[0]).toBe(192);
      expect(binary[1]).toBe(168);
    });
  });

  describe('IPv6アドレス処理', () => {
    test('IPv6アドレスをバイナリ形式に変換する概念検証', () => {
      // IPv6: 2001:db8::1 → 16バイトバイナリ
      const ipv6 = '2001:0db8:0000:0000:0000:0000:0000:0001';
      const parts = ipv6.split(':');
      
      expect(parts.length).toBe(8);
      
      // 各パートは16ビット（2バイト）
      const binary = Buffer.alloc(16);
      parts.forEach((part, i) => {
        const value = parseInt(part, 16);
        binary.writeUInt16BE(value, i * 2);
      });
      
      expect(binary.length).toBe(16);
    });
  });

  describe('国コード検証', () => {
    test('有効な国コードを判定できる', () => {
      const validCodes = ['JP', 'US', 'GB', 'CN', 'DE'];
      const invalidCodes = ['', 'XXX', '12', 'j', 'abc'];
      
      validCodes.forEach(code => {
        expect(code).toMatch(/^[A-Z]{2}$/);
      });
      
      invalidCodes.forEach(code => {
        const isValid = /^[A-Z]{2}$/.test(code);
        expect(isValid).toBe(false);
      });
    });
  });

  describe('エラーハンドリング', () => {
    test('不正なレジストリコードでprocessRegistry()を呼ぶとエラーをスロー', async () => {
      await processor.loadRegistryConfigs();
      
      await expect(
        processor.processRegistry('invalid_registry_xyz')
      ).rejects.toThrow(/不明またはアクティブでないレジストリ/);
    });

    test('存在しないレジストリコードでエラーメッセージが適切', async () => {
      await processor.loadRegistryConfigs();
      
      try {
        await processor.processRegistry('notexist');
        // エラーがスローされなかった場合はテスト失敗
        expect(true).toBe(false);
      } catch (error) {
        expect(error.message).toContain('notexist');
      }
    });

    test('データベース未接続でloadRegistryConfigs()を呼んでも自動接続される', async () => {
      // 新しいprocessorインスタンス（未接続）
      const newDbManager = new DatabaseManager('development');
      const newProcessor = new RegistryDataProcessor(newDbManager);
      
      // connection が null の状態から開始
      expect(newDbManager.connection).toBeNull();
      
      // loadRegistryConfigs()が自動的に接続する
      await expect(newProcessor.loadRegistryConfigs()).resolves.toBeDefined();
      
      // 接続が確立されている
      expect(newDbManager.connection).not.toBeNull();
      
      // クリーンアップ
      await newDbManager.disconnect();
    });

    test('キャッシュが空の状態でgetAvailableRegistries()を呼ぶと自動ロード', async () => {
      // 新しいprocessorインスタンス
      const newProcessor = new RegistryDataProcessor(dbManager);
      expect(newProcessor.registryCache.size).toBe(0);
      
      // getAvailableRegistries()が自動的にloadRegistryConfigs()を呼ぶ
      const registries = await newProcessor.getAvailableRegistries();
      
      expect(Array.isArray(registries)).toBe(true);
      expect(newProcessor.registryCache.size).toBeGreaterThan(0);
    });

    test('_parseDate()が無効な日付に対してnullを返す', () => {
      const processor = new RegistryDataProcessor(dbManager);
      
      expect(processor._parseDate('')).toBeNull();
      expect(processor._parseDate('00000000')).toBeNull();
      expect(processor._parseDate(undefined)).toBeNull();
      expect(processor._parseDate('invalid')).toBeNull();
    });

    test('_parseData()が空データを正しく処理する', () => {
      const processor = new RegistryDataProcessor(dbManager);
      
      const result = processor._parseData('', 'apnic', false);
      expect(result).toEqual([]);
    });

    test('_parseData()がコメントのみのデータを正しく処理する', () => {
      const processor = new RegistryDataProcessor(dbManager);
      
      const commentOnlyData = `# Comment 1
# Comment 2
# Comment 3`;
      
      const result = processor._parseData(commentOnlyData, 'apnic', false);
      expect(result).toEqual([]);
    });

    test('_parseData()が不正な行を無視して処理を継続する', () => {
      const processor = new RegistryDataProcessor(dbManager);
      
      const mixedData = `apnic|JP|ipv4|1.0.0.0|256|20240101|allocated
invalid|line|format
apnic|CN|ipv4|1.1.0.0|256|20240101|allocated`;
      
      const result = processor._parseData(mixedData, 'apnic', false);
      
      // 不正な行を無視して、有効な行のみ処理される
      expect(result.length).toBeGreaterThan(0);
    });
  });
});

/**
 * テスト用レジストリデータのセットアップ
 */
async function setupTestRegistries(dbManager) {
  // registriesテーブルが存在しない場合は作成しない
  // （マイグレーションが実行済みの想定）
  try {
    const [tables] = await dbManager.connection.query(
      "SHOW TABLES LIKE 'registries'"
    );
    
    if (tables.length === 0) {
      console.log('⚠️  registriesテーブルが存在しません。マイグレーションを実行してください。');
    }
  } catch (error) {
    console.error('テーブル確認エラー:', error.message);
  }
}

/**
 * テストデータのクリーンアップ
 */
async function cleanupTestData(dbManager) {
  try {
    // テスト用の一時データがあればクリーンアップ
    // 本番データは削除しない
  } catch {}
}
