<?php

declare(strict_types=1);

// ミドルウェア設定
// HTTPリクエストの前後に実行される処理を定義

use Slim\Views\Twig;
use Slim\Views\TwigMiddleware;
use Slim\App;

return function (App $app) {
    // Twigテンプレートエンジンのミドルウェアを追加
    // HTMLレスポンスのレンダリングを可能にする
    $app->add(TwigMiddleware::createFromContainer($app, Twig::class));
};
