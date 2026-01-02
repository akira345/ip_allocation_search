<?php

declare(strict_types=1);

// IP情報アクション基底クラス
// IPアドレス関連のアクションで使用する共通機能を提供

namespace App\Application\Actions\IpInfo;

use App\Application\Actions\Action;
use App\Domain\IpInfo\IpInfoRepository;
use Psr\Log\LoggerInterface;
use Slim\Views\Twig;

/**
 * IP情報アクション基底クラス
 * IPアドレス情報の取得処理で使用するリポジトリを初期化
 */
abstract class IpInfoAction extends Action
{
  /** @var IpInfoRepository IP情報リポジトリ */
  protected $ipInfoRepository;

  /**
   * コンストラクタ
   * ロガー、ビュー、IP情報リポジトリを初期化
   */
  public function __construct(LoggerInterface $logger, Twig $view, IpInfoRepository $ipInfoRepository)
  {
    parent::__construct($logger, $view);
    $this->ipInfoRepository = $ipInfoRepository;
    $this->logger->info("Start Top page.");
  }
}
