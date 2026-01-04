import { parseCidr } from 'cidr-tools';
import { stringifyIp } from 'ip-bigint';
/**
 * IPアドレス計算ユーティリティクラス
 */
class IpCalculator {
  /**
   * IPv4アドレス範囲をCIDRブロックに分割
   * @param {string} startIp - 開始IPアドレス
   * @param {number} count - アドレス個数
   * @returns {Array<string>} CIDR表記の配列
   */
  static ipv4RangeToCidr(startIp, count) {
    try {
      const startInt = IpCalculator._ipToInt(startIp);
      const endInt = startInt + count - 1;

      const cidrBlocks = [];
      let currentStart = startInt;

      while (currentStart <= endInt) {
        // 現在の位置で使用可能な最大の2の累乗ブロックサイズを計算
        const trailingZeros = IpCalculator._countTrailingZeros(currentStart);
        const maxPowerOf2 = Math.pow(2, trailingZeros);

        // 残りのアドレス数
        const remaining = endInt - currentStart + 1;

        // 使用できる最大ブロックサイズ（残りアドレス数を超えない）
        let blockSize = Math.min(maxPowerOf2, remaining);

        // blockSizeが2の累乗になるように調整
        while (blockSize > 0 && (blockSize & (blockSize - 1)) !== 0) {
          blockSize--;
        }

        // 2の累乗でない場合は、最大の2の累乗を見つける
        if (blockSize <= 0 || (blockSize & (blockSize - 1)) !== 0) {
          blockSize = 1;
          while (blockSize * 2 <= remaining) {
            blockSize *= 2;
          }
        }

        const prefixLength = 32 - Math.log2(blockSize);
        const blockAddress = IpCalculator._intToIp(currentStart);
        cidrBlocks.push(`${blockAddress}/${prefixLength}`);

        currentStart += blockSize;
      }

      return cidrBlocks;
    } catch (error) {
      console.error(`IPv4 CIDR変換エラー: ${startIp}, count: ${count}`, error.message);
      return [];
    }
  }

  /**
   * 整数の末尾ゼロビット数を数える（プライベートメソッド）
   * @private
   * @param {number} n - 対象の整数
   * @returns {number} 末尾ゼロビット数
   */
  static _countTrailingZeros(n) {
    if (n === 0) return 32;
    let count = 0;
    while ((n & 1) === 0) {
      n >>>= 1;
      count++;
    }
    return count;
  }

  /**
   * IPv4アドレス文字列を32ビット整数に変換する（プライベートメソッド）
   * @private
   * @param {string} ip - IPv4アドレス文字列 (例: "192.168.1.1")
   * @returns {number} 32ビット整数表現
   */
  static _ipToInt(ip) {
    const parts = ip.split('.').map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  /**
   * 32ビット整数をIPv4アドレス文字列に変換する（プライベートメソッド）
   * @private
   * @param {number} int - 32ビット整数
   * @returns {string} IPv4アドレス文字列 (例: "192.168.1.1")
   */
  static _intToIp(int) {
    return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join('.');
  }

  /**
   * CIDR表記からプレフィックス長を抽出
   * @param {string} cidr - CIDR表記 (例: "192.168.1.0/24")
   * @returns {number} プレフィックス長
   */
  static getPrefixLength(cidr) {
    const parts = cidr.split('/');
    return parts.length > 1 ? parseInt(parts[1], 10) : 0;
  }

  /**
   * IPv4範囲から開始IP・終了IPを計算
   * @param {string} startIp - 開始IPアドレス
   * @param {number} count - アドレス個数
   * @returns {Object} {startIp: string, endIp: string}
   */
  static calculateIpv4Range(startIp, count) {
    try {
      const startInt = IpCalculator._ipToInt(startIp);
      const endInt = startInt + count - 1;
      const endIp = IpCalculator._intToIp(endInt);

      return {
        startIp,
        endIp,
      };
    } catch (error) {
      console.error(`IPv4範囲計算エラー: ${startIp}, count: ${count}`, error.message);
      return { startIp, endIp: startIp };
    }
  }

  /**
   * CIDR表記から開始IP・終了IPを計算
   * @param {string} cidr - CIDR表記 (例: "192.168.1.0/24" または "2001:db8::/32")
   * @returns {Object} {startIp: string, endIp: string}
   */
  static calculateCidrRange(cidr) {
    try {
      // cidr-toolsでCIDRを解析
      const parsed = parseCidr(cidr);

      // BigIntをIPアドレス文字列に変換
      const startIp = stringifyIp({ number: parsed.start, version: parsed.version });
      const endIp = stringifyIp({ number: parsed.end, version: parsed.version });

      return {
        startIp,
        endIp,
      };
    } catch (error) {
      console.error(`CIDR範囲計算エラー: ${cidr}`, error.message);
      const [ipAddress] = cidr.split('/');
      return { startIp: ipAddress, endIp: ipAddress };
    }
  }
}

export default IpCalculator;
