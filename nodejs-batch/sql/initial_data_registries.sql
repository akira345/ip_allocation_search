-- ===================================
-- 初期データ投入 - registriesテーブル
-- ===================================

INSERT INTO `registries` (`registry_code`, `registry_name`, `region`, `url`, `data_source_url`) VALUES
('afrinic', 'African Network Information Centre', 'Africa', 'https://www.afrinic.net/', 'https://ftp.afrinic.net/pub/stats/afrinic/delegated-afrinic-latest'),
('apnic', 'Asia-Pacific Network Information Centre', 'Asia-Pacific', 'https://www.apnic.net/', 'http://ftp.apnic.net/stats/apnic/delegated-apnic-latest'),
('arin', 'American Registry for Internet Numbers', 'North America', 'https://www.arin.net/', 'https://ftp.arin.net/pub/stats/arin/delegated-arin-extended-latest'),
('lacnic', 'Latin America and Caribbean Network Information Centre', 'Latin America and Caribbean', 'https://www.lacnic.net/', 'https://ftp.lacnic.net/pub/stats/lacnic/delegated-lacnic-latest'),
('ripencc', 'Réseaux IP Européens Network Coordination Centre', 'Europe, Middle East and Central Asia', 'https://www.ripe.net/', 'https://ftp.ripe.net/pub/stats/ripencc/delegated-ripencc-latest');