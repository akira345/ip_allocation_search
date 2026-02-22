# slim-iplist テスト環境とCI/CD実装完了

## 概要

slim-iplistはPHP Slim Framework製のIPアドレス割り当て検索APIフロントエンドです。
Renovateによるcomposerパッケージの自動更新に対し、テストで機能を検証し、問題なければ自動マージする仕組みを導入しました。

## 実装されたファイル

### PHPUnit テスト環境
- `phpunit.xml` - PHPUnit設定（PHP 8.3固定）
- `tests/bootstrap.php` - テスト共通セットアップ
- `config/db.test.php` - テスト用データベース設定

### テストファイル
- `tests/Unit/FunctionTest.php` - ヘルパー関数のユニットテスト
  - `format_ipv6_address_count()` 関数のテスト
  - `createRenderArray()` 関数のテスト
- `tests/Integration/DbIpInfoRepositoryTest.php` - リポジトリクラスの統合テスト
  - IPv4/IPv6アドレス検索
  - 日本サブネット一覧取得
  - エラーハンドリング
- `tests/Functional/ApiEndpointTest.php` - APIエンドポイントの機能テスト
  - ルートページのレンダリング
  - IPアドレス検索API
  - JSON API（日本IPリスト）
  - エラーレスポンスの検証

### CI/CD
- `.github/workflows/test.yml` - GitHub Actionsワークフロー（PHPテスト追加）
- `renovate.json` - Renovate自動マージ設定（既存）

### composer.json確認
- PHPUnit 11.5.55（既存）
- PHP 8.3固定要件
- テスト用スクリプト:
  - `composer test` - PHPUnit実行
  - `composer cs-check` - コードスタイルチェック
  - `composer phpstan` - 静的解析

## テストの種類

### 1. ユニットテスト（Unit Tests）
- **対象**: `app/function.php` のヘルパー関数
- **独立性**: データベース不要、純粋な関数テスト
- **テストケース**:
  - IPv6アドレス数フォーマットの正確性
  - レンダリング配列生成のロジック
  - デフォルト値とマージ処理

### 2. 統合テスト（Integration Tests）
- **対象**: `DbIpInfoRepository` クラス
- **依存**: MySQL データベース必須
- **テストケース**:
  - IPv4アドレス検索（TEST-NET-1範囲）
  - IPv6アドレス検索（Documentation prefix）
  - 存在しないIPアドレスの処理
  - 無効なIPアドレスのエラーハンドリング
  - 日本サブネット一覧API

### 3. 機能テスト（Functional Tests）
- **対象**: Slim Framework アプリケーション全体
- **依存**: アプリケーション起動、データベース接続
- **テストケース**:
  - `/` ルートページの正常表示
  - `/json` JSON APIの構造検証
  - 無効IPアドレスのエラーハンドリング
  - プライベートIPアドレスの拒否
  - 404エラーレスポンス

## GitHub Actions CI/CD フロー

### Node.js バッチ処理（既存）
1. **コードチェックアウト**
2. **Node.js 22 セットアップ**
3. **依存関係インストール** (`npm ci`)
4. **MySQLコンテナ起動** （MySQL 8.4 LTS、ヘルスチェック付き）
5. **データベースマイグレーション実行**
6. **Node.js Lintチェック**
7. **Node.js テスト実行**（ユニット/統合/E2E）
8. **カバレッジレポート生成**

### PHP フロントエンド（新規追加）
9. **PHP 8.3 セットアップ** - shivammathur/setup-php@v2
10. **Composer依存関係インストール** - キャッシュ対応
11. **PHP Lintチェック** (`composer cs-check`)
12. **PHPStan 静的解析** (`composer phpstan`)
13. **PHPUnit テスト実行** (`composer test`)
    - 環境変数でテストDBに接続
    - ユニット/統合/機能テストを一括実行

### Renovate 自動マージ
14. **全テスト成功時**: マイナー/パッチ更新を自動マージ
15. **メジャー更新**: 手動レビュー必須（breaking-changeラベル）

## PHP環境要件

- **PHPバージョン**: 8.3固定
  - GitHub Actionsでも8.3を使用
  - これより古いバージョンでは動作不要
  - 最新の言語機能を活用（属性構文など）
- **必須拡張機能**:
  - `pdo` - データベース抽象化レイヤー
  - `pdo_mysql` - MySQL接続
  - `json` - JSON処理

## Renovate 自動マージ設定

### 自動マージされる更新（既存設定）
- **Minor/Patch更新**: テスト成功後に自動マージ
- **セキュリティ更新**: 優先的にグループ化して自動マージ

### 手動レビューが必要な更新
- **Majorバージョン更新**: `breaking-change` ラベル付きで手動レビュー必須

### 設定詳細
- **スケジュール**: 月曜日 午前6時前
- **PR同時実行**: 最大5件
- **PR時間制限**: 1時間に2件まで
- **安定化期間**: 3日間
- **必須ステータスチェック**: `test` ワークフロー成功

## 使い方

### ローカルでのテスト実行

**重要**: slim-iplistのテストはDockerコンテナ内で実行する必要があります。

```bash
# データベース起動（Docker Compose）
docker compose up -d

# Node.jsバッチでデータベースにデータを投入
cd nodejs-batch
echo "yes" | node src/index.js --environment development --migrate
node src/index.js --environment development --test-mode --ipv4-limit 100 --ipv6-limit 50 --registry apnic

# PHPテスト実行（Dockerコンテナ内）
cd ../slim-iplist

# 提供されているスクリプトで全テスト実行
./run-tests.sh all

# または個別にテスト種別を指定
./run-tests.sh unit          # ユニットテストのみ（DB不要）
./run-tests.sh integration   # 統合テストのみ（DB必要）
./run-tests.sh functional    # 機能テストのみ（DB必要）
./run-tests.sh check         # コード品質チェック
```

**内部動作**: `run-tests.sh`スクリプトは自動的に：
- Dockerコンテナ（`ip_allocation_search-web-1`）内でテストを実行
- 環境変数でMySQLコンテナ（`mysql_db`）に接続
- Composer依存関係を確認・インストール

### Dockerコンテナ内で直接実行する場合

```bash
# コンテナ名を確認
docker ps

# コンテナ内でテスト実行
docker exec ip_allocation_search-web-1 bash -c "cd /var/www/web && vendor/bin/phpunit --testsuite=Unit"

# 環境変数付きで実行（統合/機能テスト）
docker exec ip_allocation_search-web-1 bash -c "cd /var/www/web && DB_HOST=mysql_db DB_PORT=3306 DB_USER=root DB_PASSWORD=passwd DB_NAME=test_db vendor/bin/phpunit"
```

### CI/CDでの動作確認

1. GitHubリポジトリにプッシュまたはPR作成
2. GitHub Actionsが自動実行
   - Node.jsバッチのテスト
   - PHPフロントエンドのテスト
3. 全テスト成功でRenovateのPRが自動マージ

## テストデータ

### 統合テスト・機能テスト用データ
- **IPv4**: `192.0.2.0/24` (TEST-NET-1)
  - 国: US
  - ステータス: allocated
- **IPv6**: `2001:db8::/32` (Documentation prefix)
  - 国: JP
  - ステータス: allocated

これらはRFC予約済みの文書化用アドレスであり、実際のインターネットでは使用されません。

## カバレッジ対象

### カバレッジ範囲
- `app/function.php` - ヘルパー関数
- `src/Infrastructure/Persistence/IpInfo/DbIpInfoRepository.php` - リポジトリ
- `src/Application/Actions/IpInfo/*` - アクションクラス

### カバレッジ除外
- `vendor/` - Composer依存パッケージ
- `templates/` - Twigテンプレート
- `public/index.php` - エントリーポイント（手動テスト）

## トラブルシューティング

### データベース接続エラー
- 環境変数 `DB_*` が正しく設定されているか確認
- MySQLが起動しているか確認: `docker ps`
- `config/db.test.php` が存在するか確認

### テストスキップ
- 統合テスト・機能テストはデータベース接続が必要
- 接続できない場合は自動的にスキップされます

### Composerキャッシュエラー
```bash
composer clear-cache
composer install
```

## 今後の拡張

1. **カバレッジレポート**: PHPUnit Coverage（Xdebug必要）
2. **モックテスト**: whoisコマンドやDNS逆引きのモック化
3. **パフォーマンステスト**: 大量データでの検索速度測定
4. **セキュリティテスト**: SQLインジェクション対策検証

## まとめ

- ✅ PHPUnit環境構築完了（PHP 8.3固定）
- ✅ ユニット/統合/機能テストを実装
- ✅ GitHub Actions CI/CD統合
- ✅ Renovate自動マージ対応
- ✅ Node.jsバッチとPHPフロントエンドの両方をテスト

これにより、composerパッケージのバージョン更新時も安全に自動マージできる環境が整いました。
