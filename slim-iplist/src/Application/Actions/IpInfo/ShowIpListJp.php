<?php

declare(strict_types=1);

// 日本IPリストJSON出力アクション
// 日本のサブネット一覧をJSON形式で返すAPIエンドポイント

namespace App\Application\Actions\IpInfo;

use App\Application\Actions\IpInfo\IpInfoAction;
use Psr\Http\Message\ResponseInterface as Response;

/**
 * 日本IPリスト出力クラス
 * 日本のサブネット情報をJSON形式で返す
 */
class ShowIpListJp extends IpInfoAction
{
  /**
   * JSON API処理
   * 日本のサブネット一覧をデータベースから取得しJSONで返す
   * @return Response JSONレスポンス
   */
  protected function action(): Response
  {
    $render = array();
    // 日本のサブネット情報を取得
    $render = $this->ipInfoRepository->findJpSubnets();
    $this->logger->info("Generate IPlist for JP.");
    // JSON形式でレスポンスを返す
    return $this->respondWithData(array('ip_block' => $render));
  }
}
