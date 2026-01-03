<?php

declare(strict_types=1);

// DIコンテナの依存関係定義
// Slim Frameworkで使用するサービスクラスの依存関係注入を設定

use App\Application\Settings\SettingsInterface;
use DI\ContainerBuilder;
use Monolog\Handler\StreamHandler;
use Monolog\Logger;
use Monolog\Processor\UidProcessor;
use Psr\Container\ContainerInterface;
use Psr\Log\LoggerInterface;
use Slim\Views\Twig;
use Twig\Loader\FilesystemLoader;
use Monolog\Processor\MemoryUsageProcessor;
use Monolog\Processor\WebProcessor;

return function (ContainerBuilder $containerBuilder) {
    $containerBuilder->addDefinitions([
        // Monologロガー設定
        // アプリケーションのログ出力を管理
        LoggerInterface::class => function (ContainerInterface $c) {
            $settings = $c->get(SettingsInterface::class);

            $loggerSettings = $settings->get('logger');
            $logger = new Logger($loggerSettings['name']);

            // ユニークIDプロセッサを追加（リクエストごとにユニークIDを付与）
            $processor = new UidProcessor();
            $logger->pushProcessor($processor);

            // ログファイルへの出力ハンドラー
            $handler = new StreamHandler($loggerSettings['path'], $loggerSettings['level']);
            $logger->pushHandler($handler);

            // メモリ使用量とWebリクエスト情報を記録
            $logger->pushProcessor(new MemoryUsageProcessor());
            $logger->pushProcessor(new WebProcessor());

            return $logger;
        },

        // Twigテンプレートエンジン設定
        // HTMLテンプレートのレンダリングを担当
        Twig::class => function (ContainerInterface $c) {
            $settings = $c->get(SettingsInterface::class);

            $viewSettings = $settings->get('view');
            $loader = new FilesystemLoader();

            // テンプレートパスの設定
            $paths = [$viewSettings['path']];
            foreach ($paths as $namespace => $path) {
                if (is_string($namespace)) {
                    $loader->setPaths($path, $namespace);
                } else {
                    $loader->addPath($path);
                }
            }

            // Twigインスタンスの生成と設定適用
            $view = new Twig($loader, $viewSettings['settings']);
            return $view;
        }
    ]);
};
