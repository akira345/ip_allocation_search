<?php

declare(strict_types=1);

namespace Tests\Integration;

use App\Infrastructure\Persistence\IpInfo\DbIpInfoRepository;
use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\Test;
use Psr\Log\NullLogger;

/**
 * DbIpInfoRepository統合テスト
 * データベースとの実際の接続をテスト
 */
class DbIpInfoRepositoryTest extends TestCase
{
    private DbIpInfoRepository $repository;
    private \PDO $db;

    protected function setUp(): void
    {
        parent::setUp();

        // データベース接続をチェック - 環境変数が設定されていない場合はスキップ
        try {
            $this->db = getDB();
            $this->repository = new DbIpInfoRepository(new NullLogger());
        } catch (\PDOException $e) {
            $this->markTestSkipped('Database connection not available: ' . $e->getMessage());
        }

        // テストデータの準備
        $this->seedTestData();
    }

    protected function tearDown(): void
    {
        // テストデータのクリーンアップ
        if (isset($this->db)) {
            $this->db->exec("DELETE FROM ip_allocations WHERE registry = 'test'");
            $this->db->exec("DELETE FROM whois_cache WHERE ip_address LIKE '192.0.2.%'");
        }

        parent::tearDown();
    }

    /**
     * テストデータの準備
     */
    private function seedTestData(): void
    {
        // 国コードとレジストリが存在することを確認
        $this->db->exec("INSERT IGNORE INTO countries (country_code, country_name) VALUES ('JP', '日本')");
        $this->db->exec("INSERT IGNORE INTO countries (country_code, country_name) VALUES ('US', 'アメリカ合衆国')");
        $this->db->exec("
            INSERT IGNORE INTO registries (registry_code, registry_name, region) 
            VALUES ('test', 'Test Registry', 'Global')
        ");

        // IPv4テストデータ (192.0.2.0/24 - TEST-NET-1)
        $this->db->exec("
            INSERT INTO ip_allocations (
                registry, country_code, ip_version, 
                ip_address_binary, ip_address_text,
                ip_start_binary, ip_end_binary,
                address_count, allocation_date, status,
                netblock_cidr, prefix_length
            ) VALUES (
                'test', 'US', 4,
                INET6_ATON('192.0.2.0'), '192.0.2.0',
                INET6_ATON('192.0.2.0'), INET6_ATON('192.0.2.255'),
                256, '2024-01-01', 'allocated',
                '192.0.2.0/24', 24
            )
        ");

        // IPv6テストデータ (2001:db8::/32 - Documentation prefix)
        $this->db->exec("
            INSERT INTO ip_allocations (
                registry, country_code, ip_version, 
                ip_address_binary, ip_address_text,
                ip_start_binary, ip_end_binary,
                address_count, allocation_date, status,
                netblock_cidr, prefix_length
            ) VALUES (
                'test', 'JP', 6,
                INET6_ATON('2001:db8::'), '2001:db8::',
                INET6_ATON('2001:db8::'), INET6_ATON('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff'),
                18446744073709551615, '2024-01-01', 'allocated',
                '2001:db8::/32', 32
            )
        ");
    }

    /**
     * IPv4アドレス検索のテスト
     */
    #[Test]
    public function findIpInformation_returns_ipv4_data_when_ip_exists(): void
    {
        $result = $this->repository->findIpInformation('192.0.2.100');

        $this->assertEquals('OK', $result['data_flg']);
        $this->assertEquals('192.0.2.100', $result['in_ip']);
        $this->assertEquals('IPv4', $result['ip_version']);
        $this->assertEquals('US', $result['country_code']);
        $this->assertEquals('192.0.2.0/24', $result['netblock_cidr']);
        $this->assertEquals('アメリカ合衆国', $result['country_name']);
    }

    /**
     * IPv6アドレス検索のテスト
     */
    #[Test]
    public function findIpInformation_returns_ipv6_data_when_ip_exists(): void
    {
        $result = $this->repository->findIpInformation('2001:db8::1');

        $this->assertEquals('OK', $result['data_flg']);
        $this->assertEquals('2001:db8::1', $result['in_ip']);
        $this->assertEquals('IPv6', $result['ip_version']);
        $this->assertEquals('JP', $result['country_code']);
        $this->assertEquals('2001:db8::/32', $result['netblock_cidr']);
        $this->assertEquals('日本', $result['country_name']);
    }

    /**
     * 存在しないIPアドレスのテスト
     */
    #[Test]
    public function findIpInformation_returns_ng_when_ip_not_found(): void
    {
        $result = $this->repository->findIpInformation('203.0.113.1');

        $this->assertEquals('NG', $result['data_flg']);
        $this->assertEquals('203.0.113.1', $result['in_ip']);
    }

    /**
     * 無効なIPアドレスのテスト
     */
    #[Test]
    public function findIpInformation_returns_error_for_invalid_ip(): void
    {
        $result = $this->repository->findIpInformation('invalid_ip');

        $this->assertEquals('NG', $result['data_flg']);
        $this->assertEquals('invalid_ip', $result['in_ip']);
        $this->assertArrayHasKey('error', $result);
    }

    /**
     * 日本のサブネット一覧取得のテスト
     */
    #[Test]
    public function findJpSubnets_returns_japanese_subnets(): void
    {
        $result = $this->repository->findJpSubnets();

        $this->assertIsArray($result);
        $this->assertArrayHasKey('ipv4_netblocks', $result);
        $this->assertArrayHasKey('ipv6_netblocks', $result);
        
        // IPv6のテストデータが含まれているはず
        $this->assertContains('2001:db8::/32', $result['ipv6_netblocks']);
    }
}
