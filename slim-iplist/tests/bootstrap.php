<?php

declare(strict_types=1);

// PHPUnit Test Bootstrap
// テスト実行前の初期化処理

use DI\ContainerBuilder;

require __DIR__ . '/../vendor/autoload.php';

// テスト用の設定を読み込む
// アプリケーション関数をロードするために必要
require __DIR__ . '/../app/function.php';

// テスト用のデータベース接続設定を読み込む
// 環境変数またはテスト用の設定ファイル
if (file_exists(__DIR__ . '/../config/db.test.php')) {
    require __DIR__ . '/../config/db.test.php';
} else {
    // 環境変数がない場合はデフォルトの設定を使用（テストスキップ）
    // GitHub ActionsでDB_*環境変数を設定する
}

// テスト用のヘルパー関数があればここでロード
