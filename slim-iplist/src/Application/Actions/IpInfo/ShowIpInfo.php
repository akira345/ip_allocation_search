<?php

declare(strict_types=1);

// IPアドレス情報表示アクション
// メインページでのIPアドレス検索と情報表示を担当

namespace App\Application\Actions\IpInfo;

use App\Application\Actions\IpInfo\IpInfoAction;
use Psr\Http\Message\ResponseInterface as Response;

/**
 * IPアドレス情報表示クラス
 * URLパラメータからIPアドレスを取得し、レジストリ情報を表示
 */
class ShowIpInfo extends IpInfoAction
{
  /**
   * メイン処理
   * IPアドレスまたはホスト名からレジストリ情報を取得
   * @return Response HTMLレスポンス
   */
  protected function action(): Response
  {
    // GETパラメータからin_ipを取得
    $query = $this->resolveQuery('in_ip');
    $this->logger->info("Search Query is " . $query);
    if (!is_null($query)) {
      $in_ip = trim($query);
      // IPアドレスの箇所にURLが貼られた場合、ホスト名からIPアドレスを割り出す
      // ただしCNAMEは対象外
      $in_hostname = parse_url($in_ip, PHP_URL_HOST);
      // parse_urlが失敗した場合かつIPアドレスでもない場合はホスト名とみなす。
      // parse_urlはhttp://example.comのようにスキームがないとホスト名を正しく取得できないため。
      if (!$in_hostname && !filter_var($in_ip, FILTER_VALIDATE_IP)) {
        $in_hostname = $in_ip;
      }
      if ($in_hostname) {
        $this->logger->info("Hostname detected: " . $in_hostname);
        // IPv6で引けるかチェック
        $records = dns_get_record($in_hostname, DNS_AAAA); // AAAAレコードを取得
        if ($records) {
          $in_ip = $records[0]['ipv6'];
        } else {
          // IPv4で引けるかチェック
          $records = dns_get_record($in_hostname, DNS_A); // Aレコードを取得
          if ($records) {
            $in_ip = $records[0]['ip'];
          } else {
            // どちらも引けなかった場合は無効なリクエストとする
            $render = createRenderArray([
              "in_ip" => $in_ip,
              "error" => "無効なホスト名です。",
              "hostname" => $in_hostname
            ]);
            $this->logger->info("Invalid Hostname " . $in_hostname);
            return $this->view->render($this->response, 'index.html', $render);
          }
        }
      } else {
        $this->logger->info("IP Address detected: " . $in_ip);
        // IPアドレス直打ちの場合はIPv4かIPv6のみ受け付ける
        // グローバルIPのみ対象
        if(!filter_var($in_ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4 | FILTER_FLAG_IPV6 | FILTER_FLAG_NO_RES_RANGE | FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_GLOBAL_RANGE )) {
          $render = createRenderArray([
            "in_ip" => $in_ip,
            "error" => "無効なIPアドレスです。"
          ]);
          $this->logger->info("Invalid IP!! " . $in_ip);
          return $this->view->render($this->response, 'index.html', $render);
        }
      }
      
      $this->logger->info("Resolved IP is " . $in_ip);
      // IPアドレス情報をデータベースから取得
      $render = $this->ipInfoRepository->findIpInformation($in_ip);
    }
    // 処理完了ログ
    $this->logger->info("Action complate.");
    // メインページをレンダリング
    return $this->view->render($this->response, 'index.html', $render);
  }

}