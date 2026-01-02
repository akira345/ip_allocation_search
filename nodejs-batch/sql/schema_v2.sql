-- IPv4/IPv6対応の統合IPアドレステーブル設計 v2.0
-- 作成日: 2026-01-01

-- ===================================
-- マスターテーブル
-- ===================================

-- IPv4/IPv6対応の統合IPアドレステーブル
CREATE TABLE IF NOT EXISTS `ip_allocations` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `registry` VARCHAR(10) NOT NULL COMMENT 'レジストリ名(afrinic,apnic,arin,lacnic,ripencc)',
  `country_code` CHAR(2) NOT NULL COMMENT '国コード(ISO 3166-1 alpha-2)',
  `ip_version` TINYINT NOT NULL COMMENT 'IPバージョン(4 or 6)',
  `ip_address_binary` VARBINARY(16) NOT NULL COMMENT 'IPアドレス(バイナリ形式)',
  `ip_address_text` VARCHAR(45) NOT NULL COMMENT 'IPアドレス(文字列形式)',
  `ip_start_binary` VARBINARY(16) NOT NULL COMMENT '開始IPアドレス(バイナリ形式)',
  `ip_end_binary` VARBINARY(16) NOT NULL COMMENT '終了IPアドレス(バイナリ形式)',
  `address_count` BIGINT UNSIGNED NOT NULL COMMENT 'アドレス個数',
  `allocation_date` DATE NULL COMMENT '割り当て日',
  `status` VARCHAR(20) NOT NULL COMMENT 'ステータス(allocated,assigned,available,reserved)',
  `netblock_cidr` VARCHAR(50) NOT NULL COMMENT 'CIDR表記のネットブロック',
  `prefix_length` TINYINT NOT NULL COMMENT 'プレフィックス長',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  
  INDEX `idx_ip_version` (`ip_version`),
  INDEX `idx_ip_range` (`ip_start_binary`, `ip_end_binary`),
  INDEX `idx_composite_search` (`ip_version`, `country_code`, `registry`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='IP割り当て情報マスターテーブル';

-- ===================================
-- トランザクションテーブル（データ取得処理用）
-- ===================================

-- データ取得処理用トランザクションテーブル
-- 目的: フロントエンド検索への影響を避けるため、データ取得時の作業領域として使用
-- 処理フロー: 各レジストリデータ取得 → 本テーブルで作業 → 完了後にマスターテーブルに移行
CREATE TABLE IF NOT EXISTS `ip_allocations_trn` (
  `registry` VARCHAR(10) NOT NULL COMMENT 'レジストリ名(afrinic,apnic,arin,lacnic,ripencc)',
  `country_code` CHAR(2) NOT NULL COMMENT '国コード(ISO 3166-1 alpha-2)',
  `ip_version` TINYINT NOT NULL COMMENT 'IPバージョン(4 or 6)',
  `ip_address_binary` VARBINARY(16) NOT NULL COMMENT 'IPアドレス(バイナリ形式)',
  `ip_address_text` VARCHAR(45) NOT NULL COMMENT 'IPアドレス(文字列形式)',
  `ip_start_binary` VARBINARY(16) NOT NULL COMMENT '開始IPアドレス(バイナリ形式)',
  `ip_end_binary` VARBINARY(16) NOT NULL COMMENT '終了IPアドレス(バイナリ形式)',
  `address_count` BIGINT UNSIGNED NOT NULL COMMENT 'アドレス個数',
  `allocation_date` DATE NULL COMMENT '割り当て日',
  `status` VARCHAR(20) NOT NULL COMMENT 'ステータス(allocated,assigned,available,reserved)',
  `netblock_cidr` VARCHAR(50) NOT NULL COMMENT 'CIDR表記のネットブロック',
  `prefix_length` TINYINT NOT NULL COMMENT 'プレフィックス長'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='IP割り当て情報処理用トランザクションテーブル';

-- ===================================
-- マスターテーブル群
-- ===================================

-- 国コードマスターテーブル（現行システム互換）
CREATE TABLE IF NOT EXISTS `countries` (
  `country_code` CHAR(2) PRIMARY KEY COMMENT '国コード(ISO 3166-1 alpha-2)',
  `country_name` VARCHAR(100) NOT NULL COMMENT '国名(日本語)'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='国コードマスターテーブル';

-- レジストリマスターテーブル
CREATE TABLE IF NOT EXISTS `registries` (
  `registry_code` VARCHAR(10) PRIMARY KEY COMMENT 'レジストリコード',
  `registry_name` VARCHAR(100) NOT NULL COMMENT 'レジストリ正式名称',
  `region` VARCHAR(50) NOT NULL COMMENT '管轄地域',
  `url` VARCHAR(255) NULL COMMENT '公式サイトURL',
  `data_source_url` VARCHAR(255) NULL COMMENT 'データソースURL',
  `is_active` BOOLEAN DEFAULT TRUE COMMENT 'アクティブフラグ',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='レジストリマスターテーブル';

-- ===================================
-- ログテーブル
-- ===================================

-- 処理ログテーブル
CREATE TABLE IF NOT EXISTS `processing_logs` (
  `id` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `registry` VARCHAR(10) NOT NULL,
  `process_date` DATE NOT NULL COMMENT '処理日',
  `status` ENUM('started', 'completed', 'failed') NOT NULL COMMENT '処理ステータス',
  `records_processed` BIGINT UNSIGNED DEFAULT 0 COMMENT '処理レコード数',
  `error_message` TEXT NULL COMMENT 'エラーメッセージ',
  `execution_time_seconds` INT UNSIGNED NULL COMMENT '実行時間(秒)',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  INDEX `idx_registry_date` (`registry`, `process_date`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='処理ログテーブル';

-- ===================================
-- キャッシュテーブル
-- ===================================

-- whoisキャッシュテーブル
-- 目的: whoisコマンドの実行結果を24時間キャッシュしてパフォーマンスを向上
CREATE TABLE IF NOT EXISTS `whois_cache` (
  `ip_address` VARCHAR(45) PRIMARY KEY COMMENT 'IPアドレス(IPv4/IPv6)',
  `whois_data` MEDIUMTEXT NOT NULL COMMENT 'whois実行結果',
  `hostname` VARCHAR(255) NULL COMMENT '逆引きホスト名',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '作成日時',
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新日時',
  
  INDEX `idx_updated_at` (`updated_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='whoisキャッシュテーブル';

