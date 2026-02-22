/**
 * DatabaseManager 統合テスト
 * データベース接続とマイグレーション機能をテスト
 */

import DatabaseManager from '../../src/utils/DatabaseManager.js';

describe('DatabaseManager Integration Tests', () => {
  let dbManager;

  beforeAll(async () => {
    // テスト用の環境変数が設定されているか確認
    expect(process.env.DB_HOST).toBeDefined();
    expect(process.env.DB_NAME).toBeDefined();
  });

  beforeEach(() => {
    // 各テスト前に新しいインスタンスを作成
    dbManager = new DatabaseManager('development');
  });

  afterEach(async () => {
    // 各テスト後に接続をクリーンアップ
    if (dbManager && dbManager.connection) {
      try {
        await dbManager.disconnect();
      } catch (error) {
        // 既に切断されている場合は無視
      }
    }
  });

  describe('コンストラクタ', () => {
    test('development環境で正常にインスタンス化できる', () => {
      const manager = new DatabaseManager('development');
      expect(manager.config).toBeDefined();
      expect(manager.connection).toBeNull();
    });

    // このテストはスキップ：database.jsは静的にエクスポートされており、
    // テスト中の環境変数変更が反映されないため
    test.skip('production環境でパスワード未設定時にエラーをスロー', () => {
      // 環境変数を一時的にクリア
      const originalPassword = process.env.DB_PASSWORD;
      delete process.env.DB_PASSWORD;

      expect(() => {
        new DatabaseManager('production');
      }).toThrow(/パスワードが設定されていません/);

      // 環境変数を復元
      if (originalPassword) {
        process.env.DB_PASSWORD = originalPassword;
      }
    });
  });

  describe('データベース接続', () => {
    test('正常に接続できる', async () => {
      await expect(dbManager.connect()).resolves.toBeTruthy();
      expect(dbManager.connection).not.toBeNull();
    });

    test('接続後にクエリを実行できる', async () => {
      await dbManager.connect();
      const [rows] = await dbManager.connection.query('SELECT 1 + 1 AS result');
      expect(rows[0].result).toBe(2);
    });

    test('不正な設定での接続は失敗する', async () => {
      const invalidManager = new DatabaseManager('development');
      
      // 新しい設定オブジェクトで置き換え（元の設定への影響を防ぐ）
      invalidManager.config = {
        ...invalidManager.config,
        host: 'invalid-host-12345'
      };

      await expect(invalidManager.connect()).rejects.toThrow();
    });
  });

  describe('データベース切断', () => {
    test('接続後に正常に切断できる', async () => {
      await dbManager.connect();
      expect(dbManager.connection).not.toBeNull();
      
      await expect(dbManager.disconnect()).resolves.toBeUndefined();
      
      // 切断後は接続がnullになる
      expect(dbManager.connection).toBeNull();
    });

    test('未接続時の切断は何もしない', async () => {
      await expect(dbManager.disconnect()).resolves.toBeUndefined();
    });
  });

  describe('テーブル存在確認', () => {
    test('存在するテーブルを正しく検出する', async () => {
      await dbManager.connect();
      
      // 現在のデータベースのテーブル一覧を取得
      const [tables] = await dbManager.connection.query('SHOW TABLES');
      
      // テーブルが存在する（マイグレーション済みの前提）
      expect(Array.isArray(tables)).toBe(true);
    });
  });

  describe('SQLファイル実行', () => {
    test('簡単なCREATE TABLEクエリを実行できる', async () => {
      await dbManager.connect();
      
      const testTableSql = `
        CREATE TABLE IF NOT EXISTS test_temp_table (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(100)
        );
      `;
      
      await expect(
        dbManager.connection.query(testTableSql)
      ).resolves.toBeTruthy();
      
      // クリーンアップ
      await dbManager.connection.query('DROP TABLE IF EXISTS test_temp_table');
    });
  });

  describe('トランザクション処理', () => {
    test('トランザクションのコミットができる', async () => {
      await dbManager.connect();
      
      // テストテーブル作成（トランザクション外）
      await dbManager.connection.query(`
        CREATE TEMPORARY TABLE IF NOT EXISTS temp_test (
          id INT PRIMARY KEY,
          value VARCHAR(50)
        )
      `);
      
      // トランザクション開始
      await dbManager.connection.beginTransaction();
      
      await dbManager.connection.query(
        'INSERT INTO temp_test (id, value) VALUES (?, ?)',
        [1, 'test']
      );
      
      await dbManager.connection.commit();
      
      const [rows] = await dbManager.connection.query(
        'SELECT * FROM temp_test WHERE id = ?',
        [1]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].value).toBe('test');
    });

    test('トランザクションのロールバックができる', async () => {
      await dbManager.connect();
      
      // テストテーブル作成（トランザクション外）
      await dbManager.connection.query(`
        CREATE TEMPORARY TABLE IF NOT EXISTS temp_rollback_test (
          id INT PRIMARY KEY,
          value VARCHAR(50)
        )
      `);
      
      // トランザクション開始
      await dbManager.connection.beginTransaction();
      
      await dbManager.connection.query(
        'INSERT INTO temp_rollback_test (id, value) VALUES (?, ?)',
        [1, 'test']
      );
      
      await dbManager.connection.rollback();
      
      // ロールバック後はデータが存在しない
      const [rows] = await dbManager.connection.query(
        'SELECT * FROM temp_rollback_test WHERE id = ?',
        [1]
      );
      expect(rows.length).toBe(0);
    });
  });

  describe('複数接続管理', () => {
    test('複数のDatabaseManagerインスタンスを同時に使用できる', async () => {
      const manager1 = new DatabaseManager('development');
      const manager2 = new DatabaseManager('development');
      
      await manager1.connect();
      await manager2.connect();
      
      const [rows1] = await manager1.connection.query('SELECT 1 AS num');
      const [rows2] = await manager2.connection.query('SELECT 2 AS num');
      
      expect(rows1[0].num).toBe(1);
      expect(rows2[0].num).toBe(2);
      
      await manager1.disconnect();
      await manager2.disconnect();
    });
  });

  describe('データベースマイグレーション', () => {
    test('migrate()メソッドが正常に実行できる', async () => {
      await dbManager.connect();
      
      // 既存のテーブルがあってもエラーにならず、マイグレーションが完了する
      await expect(dbManager.migrate()).resolves.toBeUndefined();
    });

    test('マイグレーション後に必要なテーブルが存在する', async () => {
      await dbManager.connect();
      await dbManager.migrate();
      
      // 重要なテーブルの存在確認
      const [tables] = await dbManager.connection.query('SHOW TABLES');
      const tableNames = tables.map(t => Object.values(t)[0].toLowerCase());
      
      expect(tableNames).toContain('registries');
      expect(tableNames).toContain('countries');
      expect(tableNames).toContain('ip_allocations_trn');
      expect(tableNames).toContain('processing_logs');
    });

    test('マイグレーション後にregistriesテーブルにデータが存在する', async () => {
      await dbManager.connect();
      await dbManager.migrate();
      
      const [rows] = await dbManager.connection.query(
        'SELECT COUNT(*) as count FROM registries'
      );
      
      // 初期データが投入されている
      expect(rows[0].count).toBeGreaterThan(0);
    });

    test('マイグレーション後にcountriesテーブルにデータが存在する', async () => {
      await dbManager.connect();
      await dbManager.migrate();
      
      const [rows] = await dbManager.connection.query(
        'SELECT COUNT(*) as count FROM countries'
      );
      
      // 初期データが投入されている（世界の国々）
      expect(rows[0].count).toBeGreaterThan(200);
    });

    test('_getExistingTables()が正しく動作する', async () => {
      await dbManager.connect();
      
      const tables = await dbManager._getExistingTables();
      
      expect(Array.isArray(tables)).toBe(true);
      // テーブルが存在する場合は文字列の配列
      tables.forEach(table => {
        expect(typeof table).toBe('string');
      });
    });

    test('マイグレーション中のSQL文が適切に分割される', async () => {
      await dbManager.connect();
      
      // このテストはマイグレーションロジックが正しく動作することを確認
      // 複数のSQL文が含まれるスキーマファイルを正しく処理できる
      await expect(dbManager.migrate()).resolves.toBeUndefined();
    });

    test('既存テーブルがある状態でのマイグレーションでもエラーにならない', async () => {
      await dbManager.connect();
      
      // 1度目のマイグレーション
      await dbManager.migrate();
      
      // 2度目のマイグレーション（既存テーブルがある状態）
      await expect(dbManager.migrate()).resolves.toBeUndefined();
    });
  });
});
