/**
 * Jest設定ファイル
 * ES Modulesサポート付き
 */

export default {
  // ES Modulesサポート（package.jsonのtype:moduleで自動判定）
  transform: {},

  // テストファイルのパターン
  testMatch: [
    '**/tests/**/*.test.js',
    '**/__tests__/**/*.js'
  ],

  // カバレッジ収集対象
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/index.js',      // メインエントリは除外
    '!src/config/**'      // 設定ファイルは除外
  ],

  // カバレッジレポート出力形式
  coverageReporters: ['text', 'lcov', 'html'],

  // カバレッジ閾値（テスト追加により45%以上を達成）
  coverageThreshold: {
    global: {
      branches: 58,
      functions: 47,
      lines: 46,
      statements: 45
    },
    // 個別ファイルの閾値（十分にテストされているもの）
    './src/utils/IpCalculator.js': {
      branches: 80,
      functions: 100,
      lines: 80,
      statements: 80
    }
  },

  // テスト環境
  testEnvironment: 'node',

  // 各テスト前のセットアップファイル（環境変数読み込み）
  setupFiles: ['<rootDir>/tests/setup.js'],

  // テストタイムアウト（データベース接続考慮）
  testTimeout: 30000,

  // verbose出力
  verbose: true,

  // テスト並列実行（統合テストでは注意）
  maxWorkers: '50%'
};
