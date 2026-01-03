<?php

declare(strict_types=1);

// ルート定義
// URLパスとアクションクラスのマッピングを設定

use App\Application\Actions\IpInfo\ShowIpInfo;
use App\Application\Actions\IpInfo\ShowIpListJp;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\App;

return function (App $app) {
    // メインページ - IPアドレス検索フォームと結果表示
    $app->get('/', ShowIpInfo::class);

    // 旧形式URL対応 - index.phpでのアクセスもサポート
    $app->get('/index.php', ShowIpInfo::class);

    // JSON API - 日本のサブネット一覧を返す
    $app->get('/json', ShowIpListJp::class);
};
