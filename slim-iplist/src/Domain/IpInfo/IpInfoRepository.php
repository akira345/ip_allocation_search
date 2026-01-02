<?php

declare(strict_types=1);

// IP情報リポジトリインターフェース
// IPアドレス情報のデータアクセスメソッドを定義

namespace App\Domain\IpInfo;

/**
 * IP情報リポジトリインターフェース
 * IPアドレス関連のデータアクセスメソッドを定義
 */
interface IpInfoRepository
{
  /**
   * IPアドレス情報を取得
   * @param string $in_ip 検索対象IPアドレス
   * @return array IPアドレスのレジストリ情報
   */
  public function findIpInformation(string $in_ip): array;

  /**
   * 日本のサブネット一覧を取得
   * @return array 日本のサブネット情報一覧
   */
  public function findJpSubnets(): array;
}
