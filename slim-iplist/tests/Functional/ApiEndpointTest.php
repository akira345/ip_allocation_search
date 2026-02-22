<?php

declare(strict_types=1);

namespace Tests\Functional;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;
use DI\ContainerBuilder;

/**
 * API機能テスト
 * エンドポイント全体の動作を検証
 */
class ApiEndpointTest extends TestCase
{
    private App $app;

    protected function setUp(): void
    {
        parent::setUp();

        // データベース接続をチェック - 環境変数が設定されていない場合はスキップ
        try {
            $this->app = $this->createApplication();
        } catch (\PDOException $e) {
            $this->markTestSkipped('Database connection not available: ' . $e->getMessage());
        }
    }

    /**
     * テスト用アプリケーションの作成
     */
    private function createApplication(): App
    {
        // getDB() と app/function.php は tests/bootstrap.php で読み込み済み

        // DIコンテナビルダー
        $containerBuilder = new ContainerBuilder();

        // 設定の読み込み
        $settings = require __DIR__ . '/../../app/settings.php';
        $settings($containerBuilder);

        // 依存関係の読み込み
        $dependencies = require __DIR__ . '/../../app/dependencies.php';
        $dependencies($containerBuilder);

        // リポジトリの読み込み
        $repositories = require __DIR__ . '/../../app/repositories.php';
        $repositories($containerBuilder);

        // コンテナのビルド
        $container = $containerBuilder->build();

        // Slim Appの作成
        \Slim\Factory\AppFactory::setContainer($container);
        $app = \Slim\Factory\AppFactory::create();

        // ミドルウェアの設定
        $middleware = require __DIR__ . '/../../app/middleware.php';
        $middleware($app);

        // ルートの設定
        $routes = require __DIR__ . '/../../app/routes.php';
        $routes($app);

        return $app;
    }

    /**
     * ルートページのテスト
     */
    #[Test]
    public function root_endpoint_returns_successful_response(): void
    {
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/');
        $response = $this->app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
        $contentType = $response->getHeaderLine('Content-Type');
        // Content-Typeが空でない、またはtext/htmlが含まれている
        $this->assertTrue(
            empty($contentType) || str_contains($contentType, 'text/html'),
            "Expected Content-Type to be empty or contain 'text/html', got: {$contentType}"
        );
    }

    /**
     * IPアドレス検索のテスト（無効なIP）
     */
    #[Test]
    public function ip_search_with_invalid_ip_returns_error_message(): void
    {
        $request = (new ServerRequestFactory())->createServerRequest(
            'GET',
            '/?in_ip=invalid_ip'
        );
        $response = $this->app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
        $body = (string) $response->getBody();
        
        // エラーメッセージが含まれているはず
        $this->assertStringContainsString('IPアドレス', $body);
    }

    /**
     * IPアドレス検索のテスト（プライベートIP）
     */
    #[Test]
    public function ip_search_with_private_ip_returns_error_message(): void
    {
        $request = (new ServerRequestFactory())->createServerRequest(
            'GET',
            '/?in_ip=192.168.1.1'
        );
        $response = $this->app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
        $body = (string) $response->getBody();
        
        // プライベートIPはエラーになるはず
        $this->assertStringContainsString('無効', $body);
    }

    /**
     * 日本IPリストJSON APIのテスト
     */
    #[Test]
    public function json_endpoint_returns_valid_json_structure(): void
    {
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/json');
        $response = $this->app->handle($request);

        $this->assertEquals(200, $response->getStatusCode());
        $contentType = $response->getHeaderLine('Content-Type');
        $this->assertStringContainsString('application/json', $contentType);

        $body = (string) $response->getBody();
        $data = json_decode($body, true);

        $this->assertIsArray($data);
        
        // データ構造の検証 - statusとdataキーを持つ可能性がある
        if (isset($data['data'])) {
            // Slim Frameworkのレスポンス形式
            $actualData = $data['data'];
        } else {
            $actualData = $data;
        }
        
        $this->assertArrayHasKey('ipv4_netblocks', $actualData);
        $this->assertArrayHasKey('ipv6_netblocks', $actualData);
        $this->assertIsArray($actualData['ipv4_netblocks']);
        $this->assertIsArray($actualData['ipv6_netblocks']);
    }

    /**
     * 存在しないパスのテスト
     */
    #[Test]
    public function non_existent_path_returns_404(): void
    {
        $request = (new ServerRequestFactory())->createServerRequest('GET', '/nonexistent');
        
        try {
            $response = $this->app->handle($request);
            // エラーミドルウェアが設定されていれば404レスポンスが返る
            $this->assertEquals(404, $response->getStatusCode());
        } catch (\Slim\Exception\HttpNotFoundException $e) {
            // 例外が投げられた場合も404として扱う
            $this->assertEquals(404, $e->getCode());
        }
    }
}
