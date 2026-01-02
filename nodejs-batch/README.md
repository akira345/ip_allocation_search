# IP Registry Data Processor (Node.js版)

現行システムのシェルスクリプト処理をNode.jsで置き換えたバッチプログラムです。

## 概要

このプロジェクトは、世界5大地域インターネットレジストリ（RIR）から IP アドレス割り当てデータを自動取得し、MySQL データベースに格納するバッチプログラムです。

### 対応レジストリ

- **AFRINIC** (アフリカ地域ネットワーク情報センター)
- **APNIC** (アジア太平洋ネットワーク情報センター) 
- **ARIN** (北米インターネット番号登録機関)
- **LACNIC** (中南米・カリブ海インターネットアドレスレジストリ)
- **RIPE NCC** (欧州・中東・中央アジア地域IP番号管理組織)

## 主な機能

- IPv4/IPv6 アドレス情報の統合処理
- CIDR 形式への自動変換（現行 ipcount コマンドの代替）
- MySQL 8.x 対応（認証方式の変更に対応）
- バイナリ形式でのIPアドレス保存（検索性能向上）
- 処理ログの自動記録
- 並列処理対応
- 安全なデータベースマイグレーション（既存データ保護）
- テストモード（制限数での動作確認）

## 必要環境

- Node.js 22.12.0 以上
- MySQL 8.0 以上
- Linux/Unix環境（CRON実行想定）

## インストール

```bash
cd nodejs-batch
npm install

# オプション: .envファイルを使用する場合
npm install dotenv
```

## データベース初期化

```bash
# スキーマ適用とテーブル作成（環境指定必須）
node src/index.js --environment development --migrate
```

## 使用方法

### 基本実行

**注意**: `--environment` または `-e` オプションでの環境指定は必須です。

```bash
# 全レジストリを順次処理
node src/index.js --environment development

# 特定レジストリのみ処理
node src/index.js --registry apnic --environment development

# 全レジストリを並列処理
node src/index.js --parallel --environment development

# 本番環境での実行
node src/index.js --environment production

# テストモード（制限数での実行）
node src/index.js --environment development --test-mode --ipv4-limit 100 --ipv6-limit 50

# マイグレーション実行（テーブル作成・初期データ投入）
node src/index.js --environment development --migrate
```

### CRON設定例

```bash
# 毎日 AM 3:00 に全レジストリデータを更新
0 3 * * * cd /path/to/nodejs-batch && node src/index.js --environment production

# 毎日 AM 3:30 に APNIC のみ更新（高頻度更新が必要な場合）
30 3 * * * cd /path/to/nodejs-batch && node src/index.js --registry apnic --environment production

# 並列処理で高速実行
0 4 * * * cd /path/to/nodejs-batch && node src/index.js --parallel --environment production
```

## 設定

### データベース接続設定

#### Development環境（開発用）
`src/config/database.js` にローカル開発用の設定が含まれています。

#### Production環境（本番用）
本番環境では環境変数で設定します：

```bash
# 環境変数設定例
export DB_HOST=your-production-host
export DB_PORT=3306
export DB_USER=your-production-user
export DB_PASSWORD=your-production-password
export DB_NAME=your-production-database

# Production2環境用（セカンダリ）
export DB_HOST2=your-production2-host
export DB_PORT2=3306  
export DB_USER2=your-production2-user
export DB_PASSWORD2=your-production2-password
export DB_NAME2=your-production2-database
```

#### .envファイルの使用（オプション）
環境変数の代わりに `.env` ファイルでも設定可能：

```bash
# .env.example を .env にコピーして編集
cp .env.example .env
# 実際の値を設定
```

**注意**: `.env` ファイルは機密情報を含むため、Gitには含まれません。

### レジストリ設定

レジストリの設定はデータベースの `registries` テーブルで管理されます。URL変更や無効化は以下のSQLで対応:

```sql
-- レジストリの無効化
UPDATE registries SET is_active = FALSE WHERE registry_code = 'apnic';

-- データソースURL変更  
UPDATE registries SET data_source_url = 'https://new-url.example.com/data' 
WHERE registry_code = 'apnic';
```

## ディレクトリ構造

```
nodejs-batch/
├── package.json              # Node.js プロジェクト設定
├── README.md                 # このファイル
├── sql/
│   ├── schema_v2.sql         # データベーススキーマ定義（テーブル作成）
│   ├── initial_data_registries.sql # レジストリマスター初期データ
│   └── initial_data_countries.sql  # 国コードマスター初期データ
└── src/
    ├── index.js              # メイン実行ファイル
    ├── config/
    │   └── database.js       # DB接続設定
    ├── processors/
    │   └── RegistryDataProcessor.js # データ処理クラス
    └── utils/
        ├── DatabaseManager.js # DB管理クラス
        └── IpCalculator.js   # IP計算ユーティリティ
```

## 処理フロー

### データ処理フロー
1. **データダウンロード**: 各レジストリから最新データを取得
2. **データ解析**: パイプ区切り形式を解析
3. **IP計算**: IPv4範囲をCIDRブロックに分割、IPv6プレフィックス処理
4. **一時保存**: `ip_allocations_trn` テーブルに格納
5. **本格納**: 処理完了後に `ip_allocations` テーブルに移行

### マイグレーション処理フロー
1. **実行確認**: ユーザーに処理継続の確認を求める
2. **テーブル作成**: CREATE TABLE IF NOT EXISTS で安全にテーブル作成
3. **初期データ投入**: 新規作成されたテーブル（registries、countries）にのみ初期データ投入
4. **データ保護**: 既存データは保持され、重複実行時も安全

## 利用可能なオプション

| オプション | 短縮形 | 説明 | 必須 |
|------------|--------|------|---------|
| `--environment` | `-e` | 実行環境 (development/production/production2) | ✅ |
| `--registry` | `-r` | 特定レジストリのみ処理 (afrinic/apnic/arin/lacnic/ripencc) | ❌ |
| `--parallel` | `-p` | 全レジストリを並列処理 | ❌ |
| `--migrate` | `-m` | データベースマイグレーション実行 | ❌ |
| `--test-mode` | `-t` | テストモード（制限数での実行） | ❌ |
| `--ipv4-limit` | - | IPv4処理制限数（テストモード用、デフォルト: 300） | ❌ |
| `--ipv6-limit` | - | IPv6処理制限数（テストモード用、デフォルト: 200） | ❌ |
| `--help` | `-h` | ヘルプ表示 | ❌ |

## データベーススキーマ

プロジェクト内の `sql/schema_v2.sql` にデータベース構造が定義されています。初回セットアップ時に自動適用されます。

## ログ

処理状況は `processing_logs` テーブルに自動記録されます:

```sql
-- 処理ログ確認
SELECT * FROM processing_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## 現行システムからの移行

### 変更点

1. **認証方式**: MySQL環境変数 → 設定ファイル
2. **IP計算**: ipcount コマンド → Node.js ネイティブ処理
3. **設定管理**: ハードコード → データベース管理
4. **IPv6対応**: 新規追加

### デバッグ

```bash
# 詳細ログ出力で実行
node src/index.js --registry apnic --environment development

# テストモードで実行（少量データで動作確認）
node src/index.js --test-mode --ipv4-limit 50 --ipv6-limit 30 --environment development
```

## 開発者向け情報

### 新しいレジストリの追加

1. `registries` テーブルに新レジストリを追加
2. 必要に応じて `RegistryDataProcessor.js` の拡張フォーマット処理を追加

### カスタマイズ

- `IpCalculator.js`: IP計算ロジックの変更
- `RegistryDataProcessor.js`: データ解析ロジックの変更
- `database.js`: 接続設定の追加