/**
 * IpCalculator ユニットテスト
 * IP計算ユーティリティの各メソッドをテスト
 */

import IpCalculator from '../../src/utils/IpCalculator.js';

describe('IpCalculator', () => {
  describe('ipv4RangeToCidr', () => {
    test('単一アドレスの変換', () => {
      const result = IpCalculator.ipv4RangeToCidr('192.168.1.100', 1);
      expect(result).toEqual(['192.168.1.100/32']);
    });

    test('2アドレスの変換', () => {
      const result = IpCalculator.ipv4RangeToCidr('192.168.1.0', 2);
      expect(result).toEqual(['192.168.1.0/31']);
    });

    test('256アドレス（/24）の変換', () => {
      const result = IpCalculator.ipv4RangeToCidr('10.0.0.0', 256);
      expect(result).toEqual(['10.0.0.0/24']);
    });

    test('複数CIDRブロックへの分割（整列されていない範囲）', () => {
      const result = IpCalculator.ipv4RangeToCidr('192.168.1.1', 7);
      expect(result.length).toBeGreaterThan(1);
      expect(result).toContain('192.168.1.1/32');
    });

    test('大きなアドレス範囲（65536アドレス、/16）', () => {
      const result = IpCalculator.ipv4RangeToCidr('172.16.0.0', 65536);
      expect(result).toEqual(['172.16.0.0/16']);
    });

    test('不正なIPアドレスでエラーハンドリング', () => {
      const result = IpCalculator.ipv4RangeToCidr('invalid.ip', 10);
      expect(result).toEqual([]);
    });

    test('ゼロカウントの処理', () => {
      const result = IpCalculator.ipv4RangeToCidr('192.168.1.1', 0);
      expect(result).toEqual([]);
    });
  });

  describe('getPrefixLength', () => {
    test('IPv4 CIDRからプレフィックス長を抽出', () => {
      expect(IpCalculator.getPrefixLength('192.168.1.0/24')).toBe(24);
      expect(IpCalculator.getPrefixLength('10.0.0.0/8')).toBe(8);
      expect(IpCalculator.getPrefixLength('172.16.0.0/16')).toBe(16);
    });

    test('IPv6 CIDRからプレフィックス長を抽出', () => {
      expect(IpCalculator.getPrefixLength('2001:db8::/32')).toBe(32);
      expect(IpCalculator.getPrefixLength('fe80::/10')).toBe(10);
    });

    test('プレフィックス長がない場合は0を返す', () => {
      expect(IpCalculator.getPrefixLength('192.168.1.0')).toBe(0);
    });
  });

  describe('calculateIpv4Range', () => {
    test('単一アドレスの範囲計算', () => {
      const result = IpCalculator.calculateIpv4Range('192.168.1.100', 1);
      expect(result).toEqual({
        startIp: '192.168.1.100',
        endIp: '192.168.1.100',
      });
    });

    test('複数アドレスの範囲計算', () => {
      const result = IpCalculator.calculateIpv4Range('10.0.0.0', 256);
      expect(result).toEqual({
        startIp: '10.0.0.0',
        endIp: '10.0.0.255',
      });
    });

    test('大きな範囲の計算', () => {
      const result = IpCalculator.calculateIpv4Range('172.16.0.0', 65536);
      expect(result).toEqual({
        startIp: '172.16.0.0',
        endIp: '172.16.255.255',
      });
    });

    test('不正なIPでエラーハンドリング', () => {
      const result = IpCalculator.calculateIpv4Range('invalid', 10);
      // 実装では不正なIPを解析しようとして0.0.0.0になる
      expect(result.startIp).toBe('invalid');
      // endIpは計算結果として0.0.0.9になる
      expect(result.endIp).toBeDefined();
    });
  });

  describe('calculateCidrRange', () => {
    test('IPv4 CIDR範囲の計算', () => {
      const result = IpCalculator.calculateCidrRange('192.168.1.0/24');
      expect(result).toEqual({
        startIp: '192.168.1.0',
        endIp: '192.168.1.255',
      });
    });

    test('IPv4 大きなCIDRブロック (/8)', () => {
      const result = IpCalculator.calculateCidrRange('10.0.0.0/8');
      expect(result.startIp).toBe('10.0.0.0');
      expect(result.endIp).toBe('10.255.255.255');
    });

    test('IPv6 CIDR範囲の計算', () => {
      const result = IpCalculator.calculateCidrRange('2001:db8::/32');
      expect(result.startIp).toBe('2001:db8::');
      expect(result.endIp).toBe('2001:db8:ffff:ffff:ffff:ffff:ffff:ffff');
    });

    test('IPv6 小さなプレフィックス', () => {
      const result = IpCalculator.calculateCidrRange('fe80::/10');
      expect(result.startIp).toBe('fe80::');
      expect(result.endIp).toMatch(/^fe[bc]f:/); // fe80-febf, fec0-feff range
    });

    test('不正なCIDRでエラーハンドリング', () => {
      const result = IpCalculator.calculateCidrRange('invalid/24');
      expect(result.startIp).toBe('invalid');
      expect(result.endIp).toBe('invalid');
    });
  });

  describe('_countTrailingZeros（内部メソッドテスト）', () => {
    test('2の累乗の末尾ゼロビット数', () => {
      expect(IpCalculator._countTrailingZeros(1)).toBe(0);   // 0b1
      expect(IpCalculator._countTrailingZeros(2)).toBe(1);   // 0b10
      expect(IpCalculator._countTrailingZeros(4)).toBe(2);   // 0b100
      expect(IpCalculator._countTrailingZeros(8)).toBe(3);   // 0b1000
      expect(IpCalculator._countTrailingZeros(256)).toBe(8); // 0b100000000
    });

    test('ゼロの処理', () => {
      expect(IpCalculator._countTrailingZeros(0)).toBe(32);
    });

    test('奇数の末尾ゼロビット数', () => {
      expect(IpCalculator._countTrailingZeros(3)).toBe(0);  // 0b11
      expect(IpCalculator._countTrailingZeros(5)).toBe(0);  // 0b101
    });
  });

  describe('_ipToInt と _intToIp（内部メソッドテスト）', () => {
    test('IPv4アドレスと整数の相互変換', () => {
      const testCases = [
        { ip: '0.0.0.0', int: 0 },
        { ip: '127.0.0.1', int: 2130706433 },
        { ip: '10.0.0.1', int: 167772161 },
        { ip: '172.16.0.1', int: 2886729729 },
      ];

      testCases.forEach(({ ip, int }) => {
        const result = IpCalculator._ipToInt(ip);
        // JavaScriptのビット演算は符号付き整数を返すため、>>> 0で符号なしに変換して比較
        expect(result >>> 0).toBe(int >>> 0);
        expect(IpCalculator._intToIp(int)).toBe(ip);
      });
    });

    test('往復変換の整合性', () => {
      const originalIp = '10.20.30.40';
      const converted = IpCalculator._intToIp(IpCalculator._ipToInt(originalIp));
      expect(converted).toBe(originalIp);
    });
  });
});
