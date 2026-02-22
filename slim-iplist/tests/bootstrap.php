<?php

declare(strict_types=1);

// PHPUnit Test Bootstrap
// テスト実行前の初期化処理

require __DIR__ . '/../vendor/autoload.php';

// テスト用の設定を読み込む
// アプリケーション関数をロードするために必要
require __DIR__ . '/../app/function.php';

// データベース接続関数の定義
// 環境変数 (DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME) から接続設定を読み込む
// ローカル環境: docker-compose の mysql_db サービスに接続
// GitHub Actions: MySQL サービスコンテナに接続
if (!function_exists('getDB')) {
    function getDB(): PDO
    {
        $dbhost = getenv('DB_HOST') ?: 'localhost';
        $dbport = getenv('DB_PORT') ?: '3306';
        $dbuser = getenv('DB_USER') ?: 'test_user';
        $dbpass = getenv('DB_PASSWORD') ?: 'test_password';
        $dbname = getenv('DB_NAME') ?: 'test_ip_allocations';

        $dsn = "mysql:host={$dbhost};port={$dbport};dbname={$dbname};charset=utf8mb4";

        $dbConnection = new PDO($dsn, $dbuser, $dbpass);
        $dbConnection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $dbConnection->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);

        return $dbConnection;
    }
}
