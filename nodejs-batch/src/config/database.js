/**
 * データベース接続設定
 * 環境に応じた設定を提供する
 */
// データベース設定
export default {
  /**
   * 開発環境用データベース設定
   */
  development: {
    host: '127.0.0.1',
    port: 3306,
    user: 'test',
    password: 'passwd',
    database: 'test_db',
    charset: 'utf8mb4',
    timezone: '+09:00',
  },

  /**
   * 本番環境用データベース設定
   * 環境変数から設定値を読み込む
   */
  production: {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD, // 必須: 環境変数で設定
    database: process.env.DB_NAME || 'production_db',
    charset: 'utf8mb4',
    timezone: '+09:00',
  },

  /**
   * 本番環境2用データベース設定
   * 環境変数から設定値を読み込む（セカンダリDB用）
   */
  production2: {
    host: process.env.DB_HOST2 || 'localhost',
    port: process.env.DB_PORT2 || 3306,
    user: process.env.DB_USER2 || 'root',
    password: process.env.DB_PASSWORD2, // 必須: 環境変数で設定
    database: process.env.DB_NAME2 || 'production2_db',
    charset: 'utf8mb4',
    timezone: '+09:00',
  },
};
