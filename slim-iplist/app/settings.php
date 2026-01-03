<?php

declare(strict_types=1);

// 全体設定の定義
// アプリケーション全体で使用される設定値を管理

use App\Application\Settings\Settings;
use App\Application\Settings\SettingsInterface;
use DI\ContainerBuilder;
use Monolog\Logger;

return function (ContainerBuilder $containerBuilder) {
    // グローバル設定オブジェクトの定義
    $containerBuilder->addDefinitions([
        SettingsInterface::class => function () {
            return new Settings([
                // エラー表示詳細（本番環境では false に設定）
                'displayErrorDetails' => false,
                // エラーログ出力設定
                'logError'            => true,
                'logErrorDetails'     => true,
                // Monologロガー設定
                'logger' => [
                    'name' => 'slim-skeleton',
                    'path' => __DIR__ . '/../logs/app.log',
                    'level' => Logger::DEBUG,
                ],
                // Twigテンプレート設定
                'view' => [
                    'path' => '../templates',
                    'settings' => [
                        'charset' => 'utf-8',
                        // テンプレートキャッシュディレクトリ
                        'cache' => realpath('../templates/cache'),
                        // 開発時の自動リロード設定
                        'auto_reload' => true,
                        // 厳密な変数チェック
                        'strict_variables' => true,
                        // HTMLエスケープの自動適用
                        'autoescape' => 'html'
                    ],
                ],
            ]);
        }
    ]);
};
