<?php

declare(strict_types=1);

// IP情報データベースリポジトリ実装クラス
// IPv4/IPv6のIP割り当て情報とwhoisキャッシュ機能を提供

namespace App\Infrastructure\Persistence\IpInfo;

use App\Domain\IpInfo\IpInfoRepository;
use Psr\Log\LoggerInterface;

/**
 * IP情報データベースリポジトリ実装
 * 機能:
 * - IPv4/IPv6統合クエリによる高速IP検索
 * - whoisコマンド結果の24時間キャッシュ
 * - ホスト名逆引きのキャッシュ機能
 * - パフォーマンス向上とAPIレート制限対策
 */
class DbIpInfoRepository implements IpInfoRepository
{
  /** @var LoggerInterface ロガーインスタンス */
  protected $logger;
  
  /**
   * コンストラクタ
   * @param LoggerInterface $logger ロガーインスタンス
   */
  public function __construct(LoggerInterface $logger)
  {
    $this->logger = $logger;
  }

  public function findIpInformation(string $in_ip): array
  {
    $render = array();
    
    // IPv4とIPv6の両方に対応
    if (filter_var($in_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
      // IPv4の場合
      return $this->findIpv4Information($in_ip);
    } elseif (filter_var($in_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV6)) {
      // IPv6の場合
      return $this->findIpv6Information($in_ip);
    } else {
      // 無効なIP
      return array(
        "in_ip" => $in_ip,
        "data_flg" => "NG",
        "error" => "無効なIPアドレスです。",
        "hostname" => "",
      );
    }
  }

  private function findIpv4Information(string $in_ip): array
  {
    $render = array();
    
    // IPv4用のクエリ - 事前計算されたip_start_binaryとip_end_binaryを使用
    $sql = "SELECT 
              ia.id,
              ia.ip_version,
              ia.ip_address_text,
              ia.netblock_cidr,
              ia.prefix_length,
              ia.address_count,
              c.country_name,
              c.country_code,
              r.registry_name,
              ia.allocation_date,
              ia.status,
              ia.registry
            FROM ip_allocations ia
            LEFT JOIN countries c ON ia.country_code = c.country_code
            LEFT JOIN registries r ON ia.registry = r.registry_code
            WHERE 
              ia.ip_version = 4 
              AND INET6_ATON(:ip) >= ia.ip_start_binary
              AND INET6_ATON(:ip) <= ia.ip_end_binary
            LIMIT 1";
    
    try {
      $db = getDB();
      $stmt = $db->prepare($sql);
      $stmt->bindParam(':ip', $in_ip, \PDO::PARAM_STR);
      $stmt->execute();
      
      $render = array(
        "in_ip" => $in_ip,
        "data_flg" => "NG",
        "hostname" => $this->getHostnameFromCache($in_ip),
      );
      
      if ($row = $stmt->fetch()) {
        // whoisデータとホスト名をキャッシュから取得
        $whois_cache = $this->getWhoisFromCache($in_ip);
        $whois_data = $whois_cache['whois_data'];
        $hostname = $whois_cache['hostname'];
        
        $allocation_date = "";
        if ($row["allocation_date"] && $row["allocation_date"] != '0000-00-00') {
          $allocation_date = date("Y/m/d", strtotime($row["allocation_date"]));
        }
        
        $render = array(
          "registry_name" => $row["registry_name"],
          "country_code" => $row["country_code"],
          "ip_address_text" => $row["ip_address_text"],
          "str_address_count" => number_format($row["address_count"]),
          "allocation_date" => $allocation_date,
          "status" => $row["status"],
          "netblock_cidr" => $row["netblock_cidr"],
          "country_name" =>  $row["country_name"],
          "in_ip" => $in_ip,
          "data_flg" => "OK",
          "whois_data" => $whois_data,
          "hostname" => $hostname,
          "ip_version" => "IPv4",
          "registry_code" => $row["registry"],
        );
      }
    } catch (\PDOException $e) {
      $this->logger->error($e->getMessage());
      $render = array(
        "in_ip" => $in_ip,
        "data_flg" => "NG",
        "error" => "Database error",
        "hostname" => "",
      );
    }
    
    return $render;
  }

  private function findIpv6Information(string $in_ip): array
  {
    $render = array();
    
    // IPv6用のクエリ - 事前計算されたip_start_binaryとip_end_binaryを使用
    $sql = "SELECT 
              ia.id,
              ia.ip_version,
              ia.ip_address_text,
              ia.netblock_cidr,
              ia.prefix_length,
              ia.address_count,
              c.country_name,
              c.country_code,
              r.registry_name,
              ia.allocation_date,
              ia.status,
              ia.registry
            FROM ip_allocations ia
            LEFT JOIN countries c ON ia.country_code = c.country_code
            LEFT JOIN registries r ON ia.registry = r.registry_code
            WHERE 
              ia.ip_version = 6 
              AND INET6_ATON(:ip) >= ia.ip_start_binary
              AND INET6_ATON(:ip) <= ia.ip_end_binary
            LIMIT 1";
    
    try {
      $db = getDB();
      $stmt = $db->prepare($sql);
      $stmt->bindParam(':ip', $in_ip, \PDO::PARAM_STR);
      $stmt->execute();
      
      $render = array(
        "in_ip" => $in_ip,
        "data_flg" => "NG",
        "hostname" => $this->getHostnameFromCache($in_ip),
      );
      
      if ($row = $stmt->fetch()) {
        // whoisデータとホスト名をキャッシュから取得
        $whois_cache = $this->getWhoisFromCache($in_ip);
        $whois_data = $whois_cache['whois_data'];
        $hostname = $whois_cache['hostname'];
        
        $allocation_date = "";
        if ($row["allocation_date"] && $row["allocation_date"] != '0000-00-00') {
          $allocation_date = date("Y/m/d", strtotime($row["allocation_date"]));
        }
        
        $render = array(
          "registry_name" => $row["registry_name"],
          "country_code" => $row["country_code"],
          "ip_address_text" => $row["ip_address_text"],
          "str_address_count" => format_ipv6_address_count($row["prefix_length"]),
          "allocation_date" => $allocation_date,
          "status" => $row["status"],
          "netblock_cidr" => $row["netblock_cidr"],
          "country_name" =>  $row["country_name"],
          "in_ip" => $in_ip,
          "data_flg" => "OK",
          "whois_data" => $whois_data,
          "hostname" => $hostname,
          "ip_version" => "IPv6",
          "prefix_length" => $row["prefix_length"],
          "registry_code" => $row["registry"],
        );
      }
    } catch (\PDOException $e) {
      $this->logger->error($e->getMessage());
      $render = array(
        "in_ip" => $in_ip,
        "data_flg" => "NG",
        "error" => "Database error",
        "hostname" => "",
      );
    }
    
    return $render;
}

  public function findJpSubnets(): array
  {
    $render = array();
    
    // 新しいip_allocationsテーブルからJPのサブネットを取得
    $sql = "SELECT 
              ia.netblock_cidr,
              ia.ip_version,
              ia.ip_address_text
            FROM ip_allocations ia
            LEFT JOIN countries c ON ia.country_code = c.country_code
            WHERE c.country_code = 'JP'
            ORDER BY ia.ip_version, ia.ip_address_binary";
    
    try {
      $db = getDB();
      $stmt = $db->prepare($sql);
      $stmt->execute();
      
      while ($row = $stmt->fetch()) {
        if (!empty($row["netblock_cidr"])) {
          array_push($render, $row["netblock_cidr"]);
        }
      }
    } catch (\PDOException $e) {
      $this->logger->error($e->getMessage());
      echo "システムエラー";
    }
    
    return $render;
  }

  /**
   * whoisデータとホスト名をキャッシュから取得
   * 24時間以内のデータが存在する場合はキャッシュを返す
   * @param string $ip_address IPアドレス
   * @return array whoisデータとホスト名
   */
  private function getWhoisFromCache(string $ip_address): array
  {
    try {
      $db = getDB();
      
      // 24時間以内のキャッシュデータを検索
      $sql = "SELECT whois_data, hostname, updated_at 
              FROM whois_cache 
              WHERE ip_address = :ip 
                AND updated_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
              LIMIT 1";
      
      $stmt = $db->prepare($sql);
      $stmt->bindParam(':ip', $ip_address, \PDO::PARAM_STR);
      $stmt->execute();
      
      if ($row = $stmt->fetch()) {
        // whoisデータが空の場合は再取得が必要
        if (empty($row['whois_data'])) {
          $this->logger->info("whois cache found but data empty, refreshing: " . $ip_address);
          // whoisデータを再取得
          $whois_data = shell_exec("whois " . escapeshellcmd($ip_address)) ?: '';
          
          // キャッシュ更新
          $update_sql = "UPDATE whois_cache 
                         SET whois_data = :whois_data, updated_at = NOW() 
                         WHERE ip_address = :ip";
          $update_stmt = $db->prepare($update_sql);
          $update_stmt->bindParam(':whois_data', $whois_data, \PDO::PARAM_STR);
          $update_stmt->bindParam(':ip', $ip_address, \PDO::PARAM_STR);
          $update_stmt->execute();
          
          return [
            'whois_data' => $whois_data,
            'hostname' => $row['hostname']
          ];
        }
        
        $this->logger->info("whois cache hit for: " . $ip_address);
        return [
          'whois_data' => $row['whois_data'],
          'hostname' => $row['hostname']
        ];
      } else {
        // キャッシュミスの場合、whoisとホスト名を取得してキャッシュします。
        $this->logger->info("whois cache miss for: " . $ip_address);
        
        // whoisコマンドとホスト名取得
        $whois_data = shell_exec("whois " . escapeshellcmd($ip_address)) ?: '';
        $hostname = gethostbyaddr($ip_address) ?: $ip_address;
        
        // キャッシュに保存（INSERT ON DUPLICATE KEY UPDATE）
        $insert_sql = "INSERT INTO whois_cache (ip_address, whois_data, hostname, updated_at)
                       VALUES (:ip, :whois_data, :hostname, NOW())
                       ON DUPLICATE KEY UPDATE 
                         whois_data = VALUES(whois_data),
                         hostname = VALUES(hostname),
                         updated_at = NOW()";
        
        $insert_stmt = $db->prepare($insert_sql);
        $insert_stmt->bindParam(':ip', $ip_address, \PDO::PARAM_STR);
        $insert_stmt->bindParam(':whois_data', $whois_data, \PDO::PARAM_STR);
        $insert_stmt->bindParam(':hostname', $hostname, \PDO::PARAM_STR);
        $insert_stmt->execute();
        
        return [
          'whois_data' => $whois_data,
          'hostname' => $hostname
        ];
      }
    } catch (\PDOException $e) {
      $this->logger->error("whois cache error: " . $e->getMessage());
      // キャッシュエラー時は直接実行
      return [
        'whois_data' => shell_exec("whois " . escapeshellcmd($ip_address)) ?: '',
        'hostname' => gethostbyaddr($ip_address) ?: $ip_address
      ];
    }
  }

  /**
   * ホスト名のみをキャッシュから取得
   * whoisデータを必要としない場合の軽量版
   * @param string $ip_address IPアドレス
   * @return string ホスト名
   */
  private function getHostnameFromCache(string $ip_address): string
  {
    try {
      $db = getDB();
      
      // 24時間以内のホスト名キャッシュを取得
      $sql = "SELECT hostname 
              FROM whois_cache 
              WHERE ip_address = :ip 
                AND updated_at > DATE_SUB(NOW(), INTERVAL 1 DAY)
              LIMIT 1";
      
      $stmt = $db->prepare($sql);
      $stmt->bindParam(':ip', $ip_address, \PDO::PARAM_STR);
      $stmt->execute();
      
      if ($row = $stmt->fetch()) {
        return $row['hostname'];
      } else {
        // キャッシュミスの場合は直接逆引き（キャッシュには保存しない）
        $hostname = gethostbyaddr($ip_address) ?: $ip_address;
        return $hostname;
      }
    } catch (\PDOException $e) {
      $this->logger->error("hostname cache error: " . $e->getMessage());
      // キャッシュエラー時は直接実行
      return gethostbyaddr($ip_address) ?: $ip_address;
    }
  }
}
