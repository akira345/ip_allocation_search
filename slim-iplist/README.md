# Slim IP List - Frontend

PHP Slim Framework製のIPアドレス割り当て検索システムのフロントエンドAPIです。

## 概要

地域インターネットレジストリ（RIR）からのIPアドレス割り当て情報を検索するREST APIを提供します。IPv4/IPv6の両方に対応し、高速な検索を実現しています。

## 特徴

- **高速検索**: 事前計算された開始IP・終了IPによる範囲検索最適化
- **IPv4/IPv6対応**: 統合テーブルでの効率的な管理
- **地域レジストリ対応**: AFRINIC, APNIC, ARIN, LACNIC, RIPE NCC
- **RESTful API**: JSON形式でのレスポンス
- **軽量フレームワーク**: Slim Framework 4.x使用

## システム要件

- PHP 8.0 以上
- MySQL 8.0 以上
- Composer
- Apache/Nginx

## ディレクトリ構成

```
slim-iplist/
├── app/                    # アプリケーション設定
│   ├── dependencies.php   # DIコンテナ設定
│   ├── middleware.php     # ミドルウェア設定
│   ├── repositories.php   # リポジトリ設定
│   ├── routes.php         # ルート定義
│   └── settings.php       # 基本設定
├── config/                # データベース設定
│   ├── db.php            # データベース接続設定
│   └── db.php.sample     # 設定サンプル
├── public/               # Webルート
│   └── index.php        # エントリーポイント
├── src/                  # ソースコード
│   ├── Application/     # アプリケーション層
│   ├── Domain/          # ドメイン層
│   └── Infrastructure/  # インフラストラクチャ層
├── templates/           # テンプレート
└── vendor/             # Composer依存関係
```

## API エンドポイント

### IP情報検索

**エンドポイント:** `GET /ip/{ip_address}`

**パラメータ:**
- `ip_address` (required): 検索対象のIPアドレス（IPv4またはIPv6）

**レスポンス例:**

```json
{
  "in_ip": "8.8.8.8",
  "data_flg": "OK",
  "hostname": "dns.google",
  "ip_version": "IPv4",
  "registry_code": "arin",
  "country_name": "United States",
  "country_code": "US",
  "registry_name": "American Registry for Internet Numbers",
  "netblock_cidr": "8.8.8.0/24",
  "allocation_date": "2014-03-14",
  "status": "allocated"
}
```

**エラーレスポンス:**

```json
{
  "in_ip": "invalid_ip",
  "data_flg": "NG",
  "error": "Invalid IP address format",
  "hostname": ""
}
```

## インストール

1. 依存関係のインストール:
```bash
composer install
```

2. データベース設定:
```bash
cp config/db.php.sample config/db.php
# config/db.php を編集してデータベース接続情報を設定
```

3. Webサーバー設定:
- `public/` ディレクトリをドキュメントルートに設定
- `.htaccess` によるURL書き換えを有効化

## Docker での実行

```bash
# プロジェクトルートから
docker-compose up -d
```

サービス起動後、`http://localhost` でAPIにアクセス可能です。

## データベーススキーマ

### ip_allocations テーブル

| カラム名 | 型 | 説明 |
|---------|----|---------|
| id | BIGINT | 主キー |
| registry | VARCHAR(10) | レジストリコード |
| country_code | CHAR(2) | 国コード |
| ip_version | TINYINT | IPバージョン(4/6) |
| ip_address_binary | VARBINARY(16) | IPアドレス（バイナリ） |
| ip_start_binary | VARBINARY(16) | 開始IP（バイナリ） |
| ip_end_binary | VARBINARY(16) | 終了IP（バイナリ） |
| netblock_cidr | VARCHAR(50) | CIDR表記 |
| allocation_date | DATE | 割り当て日 |
| status | VARCHAR(20) | ステータス |

## 開発

### ログ確認

```bash
tail -f logs/app.log
```

### デバッグモード

`app/settings.php` で以下を設定:

```php
'displayErrorDetails' => true,
'logErrors' => true,
'logErrorDetails' => true,
```


## ライセンス

MIT License
