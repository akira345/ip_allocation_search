<?php

// IPアドレス情報処理ユーティリティ関数
// IPv6アドレス数の計算・フォーマット処理を提供

/**
 * IPv6プレフィックス長から推定アドレス数を人間が読める形式で取得
 * @param int $prefix_length プレフィックス長
 * @return string フォーマットされたアドレス数
 */
function format_ipv6_address_count($prefix_length) {
  // 空値チェック
  if (empty($prefix_length)) {
    return "N/A";
  }
  
  $host_bits = 128 - intval($prefix_length);
  
  if ($host_bits <= 0) {
    return "1";
  } elseif ($host_bits >= 64) {
    return "約 " . number_format(pow(2, $host_bits)) . " (18+ quintillion)";
  } elseif ($host_bits >= 32) {
    return "約 " . number_format(pow(2, $host_bits)) . " (4+ billion)";
  } else {
    return number_format(pow(2, $host_bits));
  }
}
