<?php

declare(strict_types=1);

// アプリケーションエントリーポイント
// すべてのHTTPリクエストがこのファイルを通して処理される

// データベース接続設定とユーティリティ関数を読み込み
require '../config/db.php';
require '../app/function.php';

// Slim Framework関連クラスの読み込み
use App\Application\Handlers\HttpErrorHandler;
use App\Application\Handlers\ShutdownHandler;
use App\Application\ResponseEmitter\ResponseEmitter;
use App\Application\Settings\SettingsInterface;
use DI\ContainerBuilder;
use Slim\Factory\AppFactory;
use Slim\Factory\ServerRequestCreatorFactory;

// Composer オートローダーの読み込み
require __DIR__ . '/../vendor/autoload.php';

// PHP-DI コンテナビルダーのインスタンス化
$containerBuilder = new ContainerBuilder();

// 本番環境ではコンパイルを有効にしてパフォーマンスを向上
if (true) { // 本番環境では true に設定
    $containerBuilder->enableCompilation(__DIR__ . '/../var/cache');
}

// アプリケーション設定の読み込みと適用
$settings = require __DIR__ . '/../app/settings.php';
$settings($containerBuilder);

// 依存関係定義の読み込みと適用
$dependencies = require __DIR__ . '/../app/dependencies.php';
$dependencies($containerBuilder);

// リポジトリ設定の読み込みと適用
$repositories = require __DIR__ . '/../app/repositories.php';
$repositories($containerBuilder);

// PHP-DIコンテナインスタンスのビルド
$container = $containerBuilder->build();

// Slimアプリケーションのインスタンス化
AppFactory::setContainer($container);
$app = AppFactory::create();
$callableResolver = $app->getCallableResolver();

// ミドルウェアの登録
$middleware = require __DIR__ . '/../app/middleware.php';
$middleware($app);

// ルート設定の登録
$routes = require __DIR__ . '/../app/routes.php';
$routes($app);

/** @var SettingsInterface $settings */
// 設定オブジェクトの取得とエラーハンドリング設定の読み込み
$settings = $container->get(SettingsInterface::class);

$displayErrorDetails = $settings->get('displayErrorDetails');
$logError = $settings->get('logError');
$logErrorDetails = $settings->get('logErrorDetails');

// グローバル変数からHTTPリクエストオブジェクトを生成
$serverRequestCreator = ServerRequestCreatorFactory::create();
$request = $serverRequestCreator->createServerRequestFromGlobals();

// エラーハンドラーの作成
$responseFactory = $app->getResponseFactory();
$errorHandler = new HttpErrorHandler($callableResolver, $responseFactory);

// シャットダウンハンドラーの作成と登録
// PHP終了時にエラーを処理するためのハンドラー
$shutdownHandler = new ShutdownHandler($request, $errorHandler, $displayErrorDetails);
register_shutdown_function($shutdownHandler);

// ルーティングミドルウェアの追加
$app->addRoutingMiddleware();

// ボディパースミドルウェアの追加（POST/PUT等のデータを自動パース）
$app->addBodyParsingMiddleware();

// エラーハンドリングミドルウェアの追加
$errorMiddleware = $app->addErrorMiddleware($displayErrorDetails, $logError, $logErrorDetails);
$errorMiddleware->setDefaultErrorHandler($errorHandler);

// サブディレクトリでの運用時の設定（必要に応じて有効化）
// $app->setBasePath("/~dosmania/labo/iplist");

// アプリケーションの実行とレスポンスの送出
$response = $app->handle($request);
$responseEmitter = new ResponseEmitter();
$responseEmitter->emit($response);
