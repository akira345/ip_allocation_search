<?php

declare(strict_types=1);

// リポジトリ設定
// データアクセス層のインターフェースと実装の依存関係注入を定義

use App\Domain\IpInfo\IpInfoRepository;
use App\Infrastructure\Persistence\IpInfo\DbIpInfoRepository;
use DI\ContainerBuilder;

return function (ContainerBuilder $containerBuilder) {
    $containerBuilder->addDefinitions([
        // IPアドレス情報リポジトリの実装クラスを注入
        // インターフェースに対してデータベース実装を紐付け
        IpInfoRepository::class => \DI\autowire(DbIpInfoRepository::class),
    ]);
};
