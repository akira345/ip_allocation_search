<?php

declare(strict_types=1);

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\Test;

/**
 * ヘルパー関数のユニットテスト
 * function.phpで定義されたグローバル関数をテスト
 */
class FunctionTest extends TestCase
{
    /**
     * format_ipv6_address_count関数のテスト
     */
    #[Test]
    #[DataProvider('ipv6AddressCountProvider')]
    public function format_ipv6_address_count_returns_correct_format(
        int|null $prefixLength,
        string $expected
    ): void {
        $result = format_ipv6_address_count($prefixLength);
        $this->assertStringContainsString($expected, $result);
    }

    /**
     * format_ipv6_address_count関数のテストデータプロバイダー
     */
    public static function ipv6AddressCountProvider(): array
    {
        return [
            'null value' => [null, 'N/A'],
            'prefix 128' => [128, '1'],
            'prefix 127' => [127, '2'],
            'prefix 120' => [120, '256'],
            'prefix 112' => [112, '65,536'],
            'prefix 96' => [96, 'billion'],
            'prefix 64' => [64, 'quintillion'],
            'prefix 48' => [48, 'quintillion'],
        ];
    }

    /**
     * createRenderArray関数のテスト - デフォルト値
     */
    #[Test]
    public function createRenderArray_returns_default_values_when_no_overrides(): void
    {
        $result = createRenderArray();

        $this->assertIsArray($result);
        $this->assertArrayHasKey('in_ip', $result);
        $this->assertArrayHasKey('data_flg', $result);
        $this->assertArrayHasKey('hostname', $result);
        $this->assertArrayHasKey('error', $result);
        
        $this->assertEquals('', $result['in_ip']);
        $this->assertEquals('NG', $result['data_flg']);
        $this->assertEquals('', $result['hostname']);
    }

    /**
     * createRenderArray関数のテスト - 上書き
     */
    #[Test]
    public function createRenderArray_overrides_specified_values(): void
    {
        $overrides = [
            'in_ip' => '8.8.8.8',
            'data_flg' => 'OK',
            'hostname' => 'dns.google',
        ];

        $result = createRenderArray($overrides);

        $this->assertEquals('8.8.8.8', $result['in_ip']);
        $this->assertEquals('OK', $result['data_flg']);
        $this->assertEquals('dns.google', $result['hostname']);
        // その他のキーはデフォルト値のまま
        $this->assertEquals('', $result['error']);
        $this->assertEquals('', $result['ip_version']);
    }

    /**
     * createRenderArray関数のテスト - 全キーが存在することを確認
     */
    #[Test]
    public function createRenderArray_contains_all_expected_keys(): void
    {
        $result = createRenderArray();

        $expectedKeys = [
            'in_ip',
            'data_flg',
            'hostname',
            'error',
            'whois_data',
            'ip_version',
            'registry_name',
            'country_code',
            'country_name',
            'ip_address_text',
            'str_address_count',
            'allocation_date',
            'status',
            'netblock_cidr',
            'registry_code',
            'prefix_length',
        ];

        foreach ($expectedKeys as $key) {
            $this->assertArrayHasKey($key, $result, "Key '{$key}' is missing");
        }
    }

    /**
     * createRenderArray関数のテスト - 部分的な上書き
     */
    #[Test]
    public function createRenderArray_merges_arrays_correctly(): void
    {
        $overrides = [
            'in_ip' => '2001:4860:4860::8888',
            'ip_version' => 'IPv6',
            'country_code' => 'US',
        ];

        $result = createRenderArray($overrides);

        // 上書きされた値
        $this->assertEquals('2001:4860:4860::8888', $result['in_ip']);
        $this->assertEquals('IPv6', $result['ip_version']);
        $this->assertEquals('US', $result['country_code']);
        
        // デフォルト値のまま
        $this->assertEquals('NG', $result['data_flg']);
        $this->assertEquals('', $result['hostname']);
        $this->assertEquals('', $result['error']);
    }
}
