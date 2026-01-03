const mysql = require('mysql2/promise');
const fs = require('fs').promises;
const path = require('path');

// 環境変数の読み込み（.envファイルがある場合）
try {
  require('dotenv').config();
} catch (error) {
  // dotenvが利用できない場合は環境変数のみを使用
}

const config = require('../config/database');

/**
 * データベース管理クラス
 * MySQL接続、スキーママイグレーション、初期データ投入を管理する
 */
class DatabaseManager {
  /**
   * コンストラクタ
   * @param {string} env - 実行環境 ('development', 'production', 'production2')
   * @throws {Error} 本番環境でパスワードが設定されていない場合
   */
  constructor(env = 'development') {
    this.config = config[env];
    this.connection = null;

    // 本番環境でパスワードが未設定の場合はエラー
    if ((env === 'production' || env === 'production2') && !this.config.password) {
      throw new Error(
        `❌ ${env}環境のデータベースパスワードが設定されていません。環境変数 DB_PASSWORD${env === 'production2' ? '2' : ''} を設定してください。`,
      );
    }
  }

  /**
   * データベース接続を確立する
   * @returns {Promise<Connection>} MySQL接続オブジェクト
   * @throws {Error} 接続エラー時
   */
  async connect() {
    try {
      this.connection = await mysql.createConnection(this.config);
      console.log(`✅ MySQLに接続しました (${this.config.host}:${this.config.port}/${this.config.database})`);
      return this.connection;
    } catch (error) {
      console.error('❌ データベース接続エラー:', error.message);
      throw error;
    }
  }

  /**
   * データベース接続を終了する
   * @returns {Promise<void>}
   */
  async disconnect() {
    if (this.connection) {
      await this.connection.end();
      console.log('✅ データベース接続を終了しました');
    }
  }

  /**
   * データベーススキーマのマイグレーションを実行する
   * SQLファイルを読み込んでテーブル作成・初期データ投入を行う
   * @returns {Promise<void>}
   * @throws {Error} マイグレーションエラー時
   */
  async migrate() {
    try {
      if (!this.connection) {
        await this.connect();
      }

      // 既存テーブルの確認
      const existingTables = await this._getExistingTables();
      const tablesBeforeCreation = new Set(existingTables.map((t) => t.toLowerCase()));

      console.log(`📋 現在のテーブル数: ${existingTables.length}個`);
      if (existingTables.length > 0) {
        console.log(
          '⚠️  既存テーブルが存在します。データをリセットする場合は手動でDROP TABLEしてからマイグレーションを実行してください。',
        );
      }

      const schemaPath = path.join(__dirname, '../../sql/schema_v2.sql');
      const schemaSql = await fs.readFile(schemaPath, 'utf8');

      console.log(`📋 SQLファイル読み込み完了: ${schemaPath}`);
      console.log(`📏 ファイルサイズ: ${(schemaSql.length / 1024).toFixed(1)}KB`);

      // SQLを分割して実行
      const statements = schemaSql
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => {
          // 空文字列を除外
          if (stmt.length === 0) return false;

          // 単純なコメント行を除外（但し、CREATE文等を含む行は保持）
          const lines = stmt.split('\n');
          const hasExecutableCode = lines.some((line) => {
            const trimmedLine = line.trim();
            return (
              trimmedLine.length > 0 &&
              !trimmedLine.startsWith('--') &&
              !trimmedLine.startsWith('/*') &&
              !trimmedLine.startsWith('*') &&
              !trimmedLine.endsWith('*/')
            );
          });

          return hasExecutableCode;
        });

      console.log(`📋 ${statements.length}個のSQL文を実行します...`);

      // SQL文を実行
      for (const statement of statements) {
        if (statement.trim()) {
          const preview = statement.substring(0, 80).replace(/\s+/g, ' ');
          console.log(`🔧 実行中: ${preview}...`);

          try {
            await this.connection.execute(statement);
            console.log(`✅ 実行完了`);
          } catch (error) {
            console.error(`❌ SQL実行エラー: ${statement.substring(0, 50)}...`);
            console.error(`エラー詳細: ${error.message}`);
            throw error;
          }
        }
      }

      // テーブル作成後の状態を確認
      const tablesAfterCreation = await this._getExistingTables();
      const newTables = tablesAfterCreation.filter((table) => !tablesBeforeCreation.has(table.toLowerCase()));

      console.log(`✅ データベーススキーマの適用が完了しました`);

      // 新規作成テーブルが対象テーブルに含まれる場合のみ初期データ投入
      const initialDataTargets = ['registries', 'countries'];
      const newTargetTables = newTables.filter((table) => initialDataTargets.includes(table.toLowerCase()));

      if (newTargetTables.length > 0) {
        console.log(`🆕 新規作成対象テーブル: ${newTargetTables.join(', ')}`);
        console.log('📦 該当テーブルの初期データ投入を実行します...');
        await this._insertInitialData(newTargetTables);
      } else {
        console.log('ℹ️  初期データ投入対象テーブルの新規作成がなかったため、初期データ投入をスキップしました。');
      }
    } catch (error) {
      console.error('❌ マイグレーションエラー:', error.message);
      throw error;
    }
  }

  /**
   * データベースのテーブル状態と各テーブルのレコード数を確認する
   * @returns {Promise<void>}
   * @throws {Error} テーブル確認エラー時
   */
  async checkTables() {
    try {
      if (!this.connection) {
        await this.connect();
      }

      const [tables] = await this.connection.execute('SHOW TABLES');
      console.log('📊 データベーステーブル一覧:');
      tables.forEach((table) => {
        console.log(`  - ${Object.values(table)[0]}`);
      });

      // レコード数確認
      const tableNames = ['ip_allocations', 'ip_allocations_trn', 'countries', 'registries', 'processing_logs'];

      for (const tableName of tableNames) {
        try {
          const [count] = await this.connection.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
          console.log(`  📈 ${tableName}: ${count[0].count}件`);
        } catch (error) {
          console.log(`  ❓ ${tableName}: テーブルが存在しません`);
        }
      }
    } catch (error) {
      console.error('❌ テーブル確認エラー:', error.message);
      throw error;
    }
  }

  /**
   * データベーストランザクションを開始する
   * @returns {Promise<void>}
   */
  async beginTransaction() {
    if (!this.connection) {
      await this.connect();
    }
    await this.connection.beginTransaction();
  }

  /**
   * トランザクションをコミットする
   * @returns {Promise<void>}
   */
  async commit() {
    if (this.connection) {
      await this.connection.commit();
    }
  }

  /**
   * トランザクションをロールバックする
   * @returns {Promise<void>}
   */
  async rollback() {
    if (this.connection) {
      await this.connection.rollback();
    }
  }

  /**
   * 既存のテーブル一覧を取得する（プライベートメソッド）
   * @private
   * @returns {Promise<Array<string>>} テーブル名の配列
   */
  async _getExistingTables() {
    const [tables] = await this.connection.execute('SHOW TABLES');
    return tables.map((table) => Object.values(table)[0]);
  }

  /**
   * 指定されたテーブルに初期データを投入する（プライベートメソッド）
   * @private
   * @param {Array<string>} targetTables - 初期データ投入対象のテーブル名配列
   * @returns {Promise<void>}
   * @throws {Error} 初期データ投入エラー時
   */
  async _insertInitialData(targetTables) {
    try {
      let insertedCount = 0;

      // registriesテーブルの初期データ投入チェック
      if (targetTables.some((table) => table.toLowerCase() === 'registries')) {
        const registriesPath = path.join(__dirname, '../../sql/initial_data_registries.sql');
        await this._executeInitialDataFile(registriesPath, 'registries');
        insertedCount++;
      }

      // countriesテーブルの初期データ投入チェック
      if (targetTables.some((table) => table.toLowerCase() === 'countries')) {
        const countriesPath = path.join(__dirname, '../../sql/initial_data_countries.sql');
        await this._executeInitialDataFile(countriesPath, 'countries');
        insertedCount++;
      }

      if (insertedCount > 0) {
        console.log(`✅ ${insertedCount}個のテーブルに初期データ投入が完了しました`);
      } else {
        console.log('ℹ️  対象テーブルが見つからないため、初期データ投入をスキップしました');
      }
    } catch (error) {
      console.error('❌ 初期データ投入エラー:', error.message);
      throw error;
    }
  }

  /**
   * 初期データファイルを読み込んでINSERT文を実行する（プライベートメソッド）
   * @private
   * @param {string} filePath - SQLファイルのパス
   * @param {string} tableName - 対象テーブル名
   * @returns {Promise<void>}
   * @throws {Error} SQL実行エラー時
   */
  async _executeInitialDataFile(filePath, tableName) {
    try {
      const dataSql = await fs.readFile(filePath, 'utf8');
      console.log(`🔍 ${tableName}用SQLファイル読み込み: ${(dataSql.length / 1024).toFixed(1)}KB`);

      // INSERT文を抽出（複数行対応）
      const insertStatements = dataSql
        .split(';')
        .map((stmt) => stmt.trim())
        .filter((stmt) => {
          // コメントを除去してINSERT文を探す
          const cleanStmt = stmt
            .replace(/--.*$/gm, '')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .trim();
          return cleanStmt.toUpperCase().startsWith('INSERT');
        });

      console.log(`🔍 発見したINSERT文: ${insertStatements.length}件`);

      if (insertStatements.length > 0) {
        console.log(`📦 ${tableName}テーブルへ初期データを投入中... (${insertStatements.length}件)`);

        for (const statement of insertStatements) {
          const preview = statement.replace(/\s+/g, ' ').substring(0, 60);
          console.log(`🔧 実行: ${preview}...`);
          await this.connection.execute(statement);
        }

        console.log(`✅ ${tableName}テーブルの初期データ投入完了`);
      } else {
        console.log(`⚠️  ${tableName}テーブル用のINSERT文が見つかりませんでした`);
      }
    } catch (error) {
      console.error(`❌ ${tableName}テーブルの初期データ投入エラー:`, error.message);
      throw error;
    }
  }
}

module.exports = DatabaseManager;
