/**
 * Jest テストセットアップファイル
 * 全テスト実行前の共通初期化処理
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// __dirnameの代替（ES Modules）
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// テスト環境用の環境変数を読み込み
dotenv.config({ path: join(__dirname, '..', '.env.test') });

// グローバルなモック設定などをここに追加可能
