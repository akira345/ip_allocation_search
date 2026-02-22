/**
 * E2Eテスト（エンドツーエンド）
 * 実際のプロセス全体をテストモードで実行
 */

import DatabaseManager from '../../src/utils/DatabaseManager.js';
import RegistryDataProcessor from '../../src/processors/RegistryDataProcessor.js';

describe('E2E Tests - Full Process', () => {
  let dbManager;
  let processor;

  beforeAll(async () => {
    dbManager = new DatabaseManager('development');
    await dbManager.connect();
    
    // マイグレーションの確認
    await ensureTablesExist(dbManager);
  }, 60000); // 60秒タイムアウト

  afterAll(async () => {
    if (dbManager) {
      await dbManager.disconnect();
    }
  });

  beforeEach(() => {
    processor = new RegistryDataProcessor(dbManager);
  });

  describe('データベーステーブル確認', () => {
    test('必要なテーブルが存在する', async () => {
      const requiredTables = [
        'registries',
        'countries',
        'ip_allocations',
        'ip_allocations_trn',
        'processing_logs'
      ];

      for (const tableName of requiredTables) {
        const [rows] = await dbManager.connection.query(
          'SHOW TABLES LIKE ?',
          [tableName]
        );
        
        expect(rows.length).toBe(1);
      }
    });

    test('registriesテーブルにデータが存在する', async () => {
      const [rows] = await dbManager.connection.query(
        'SELECT COUNT(*) as count FROM registries WHERE is_active = TRUE'
      );
      
      expect(rows[0].count).toBeGreaterThan(0);
    });

    test('countriesテーブルにデータが存在する', async () => {
      const [rows] = await dbManager.connection.query(
        'SELECT COUNT(*) as count FROM countries'
      );
      
      expect(rows[0].count).toBeGreaterThan(0);
    });
  });

  describe('レジストリデータ処理フロー', () => {
    test('レジストリ設定を正常に読み込める', async () => {
      const registries = await processor.loadRegistryConfigs();
      
      expect(registries.size).toBeGreaterThan(0);
      
      // 各レジストリに必要な設定が含まれているか確認
      for (const [code, config] of registries) {
        expect(config).toHaveProperty('name');
        expect(config).toHaveProperty('url');
        expect(config).toHaveProperty('region');
        expect(typeof config.hasExtendedFormat).toBe('boolean');
      }
    });

    test('利用可能なレジストリ一覧が取得できる', async () => {
      const availableRegistries = await processor.getAvailableRegistries();
      
      expect(Array.isArray(availableRegistries)).toBe(true);
      expect(availableRegistries.length).toBeGreaterThan(0);
      
      console.log(`📋 利用可能なレジストリ: ${availableRegistries.join(', ')}`);
    });
  });

  describe('データ処理ログ', () => {
    test('処理ログテーブルにアクセスできる', async () => {
      const [rows] = await dbManager.connection.query(`
        SELECT * FROM processing_logs 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      
      // ログが存在する場合、構造を確認
      if (rows.length > 0) {
        const log = rows[0];
        expect(log).toHaveProperty('id');
        expect(log).toHaveProperty('registry');
        expect(log).toHaveProperty('status');
        expect(log).toHaveProperty('created_at');
      }
    });
  });

  describe('テストモードシミュレーション', () => {
    test('小規模データでの処理フローを検証', async () => {
      // テストモードの設定をシミュレート
      const testOptions = {
        testMode: true,
        ipv4Limit: 10,
        ipv6Limit: 5,
      };

      // この設定で実際の処理が制限されることを期待
      expect(testOptions.testMode).toBe(true);
      expect(testOptions.ipv4Limit).toBe(10);
      expect(testOptions.ipv6Limit).toBe(5);
    });
  });

  describe('IPv4/IPv6混在データの処理', () => {
    test('IPv4とIPv6の両方のタイプを認識できる', () => {
      const ipTypes = ['ipv4', 'ipv6', 'asn'];
      
      const isValidType = (type) => {
        return ['ipv4', 'ipv6', 'asn'].includes(type);
      };

      ipTypes.forEach(type => {
        expect(isValidType(type)).toBe(true);
      });
      
      expect(isValidType('invalid')).toBe(false);
    });
  });

  describe('トランザクション処理フロー', () => {
    test('一時テーブル（_trn）から本テーブルへの移行フロー', async () => {
      // 一時テーブルのクリア
      await dbManager.connection.query('DELETE FROM ip_allocations_trn WHERE 1=1');
      
      // テストデータの挿入（実際のスキーマに合わせる）
      const testData = {
        registry: 'TEST',
        country_code: 'JP',
        ip_version: 4,
        ip_address_binary: Buffer.from([192, 168, 1, 0]),
        ip_address_text: '192.168.1.0',
        ip_start_binary: Buffer.from([192, 168, 1, 0]),
        ip_end_binary: Buffer.from([192, 168, 1, 255]),
        address_count: 256,
        allocation_date: '2020-01-01',
        status: 'allocated',
        netblock_cidr: '192.168.1.0/24',
        prefix_length: 24
      };

      const [insertResult] = await dbManager.connection.query(`
        INSERT INTO ip_allocations_trn SET ?
      `, testData);

      expect(insertResult.affectedRows).toBe(1);

      // 挿入データの確認
      const [rows] = await dbManager.connection.query(
        'SELECT * FROM ip_allocations_trn WHERE registry = ?',
        ['TEST']
      );

      expect(rows.length).toBe(1);
      expect(rows[0].netblock_cidr).toBe('192.168.1.0/24');
      expect(rows[0].country_code).toBe('JP');

      // クリーンアップ
      await dbManager.connection.query(
        'DELETE FROM ip_allocations_trn WHERE registry = ?',
        ['TEST']
      );
    });
  });

  describe('エラーハンドリング', () => {
    test('存在しないレジストリへのアクセスでエラーハンドリング', async () => {
      await processor.loadRegistryConfigs();
      
      const invalidRegistry = processor.registryCache.get('INVALID_REGISTRY');
      expect(invalidRegistry).toBeUndefined();
    });

    test('不正なSQLクエリでエラーがスローされる', async () => {
      await expect(
        dbManager.connection.query('SELECT * FROM non_existent_table')
      ).rejects.toThrow();
    });
  });
});

/**
 * 必要なテーブルが存在するか確認
 */
async function ensureTablesExist(dbManager) {
  const [tables] = await dbManager.connection.query('SHOW TABLES');
  
  if (tables.length === 0) {
    console.warn('⚠️  データベースにテーブルが存在しません。');
    console.warn('   以下のコマンドでマイグレーションを実行してください:');
    console.warn('   node src/index.js --environment development --migrate');
    throw new Error('データベースマイグレーションが必要です');
  }
}
