<?php

declare(strict_types=1);

// アクション基底クラス
// すべてのアプリケーションアクションで使用する共通機能を提供

namespace App\Application\Actions;

use App\Domain\DomainException\DomainRecordNotFoundException;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;
use Slim\Exception\HttpBadRequestException;
use Slim\Exception\HttpNotFoundException;
use Slim\Views\Twig;

/**
 * アクション基底クラス
 * HTTPリクエストの処理とレスポンス生成の基本機能を提供
 */
abstract class Action
{
    /** @var LoggerInterface ロガーインスタンス */
    protected LoggerInterface $logger;

    /** @var Request HTTPリクエスト */
    protected Request $request;

    /** @var Response HTTPレスポンス */
    protected Response $response;

    /** @var array URLパスパラメータ */
    protected array $args;

    /** @var mixed クエリパラメータ */
    protected $query;

    /** @var Twig テンプレートエンジン */
    protected $view;

    /**
     * コンストラクタ
     * ロガーとテンプレートエンジンを初期化
     */
    public function __construct(LoggerInterface $logger, Twig $view)
    {
        $this->logger = $logger;
        $this->view = $view;
    }

    /**
     * アクション実行
     * HTTPリクエストを処理してレスポンスを返す
     * @throws HttpNotFoundException
     * @throws HttpBadRequestException
     */
    public function __invoke(Request $request, Response $response, array $args): Response
    {
        $this->request = $request;
        $this->response = $response;
        $this->args = $args;
        $this->query = $request->getQueryParams();

        try {
            return $this->action();
        } catch (DomainRecordNotFoundException $e) {
            throw new HttpNotFoundException($this->request, $e->getMessage());
        }
    }

    /**
     * 抽象メソッド - 実際のアクション処理
     * 各アクションクラスで実装する必要がある
     * @throws DomainRecordNotFoundException
     * @throws HttpBadRequestException
     * @return Response HTTPレスポンス
     */
    abstract protected function action(): Response;

    /**
     * フォームデータの取得
     * POST/PUTリクエストのボディからパースされたデータを返す
     * @return array|object パースされたフォームデータ
     */
    protected function getFormData()
    {
        return $this->request->getParsedBody();
    }

    /**
     * URLパスパラメータの取得
     * 指定されたパラメータ名の値を取得（必須）
     * @param string $name パラメータ名
     * @return mixed パラメータ値
     * @throws HttpBadRequestException
     */
    protected function resolveArg(string $name)
    {
        if (!isset($this->args[$name])) {
            throw new HttpBadRequestException($this->request, "Could not resolve argument `{$name}`.");
        }

        return $this->args[$name];
    }

    /**
     * クエリパラメータの取得
     * 指定されたパラメータ名の値を取得し、空白をトリム
     * @param string $name パラメータ名
     * @return mixed パラメータ値（ない場合はnull）
     */
    protected function resolveQuery(string $name)
    {
        if (!isset($this->query[$name])) {
            return null;
        }

        return trim($this->query[$name]);
    }

    /**
     * データ付きJSONレスポンスの生成
     * 指定されたデータをJSON形式で返す
     * @param array|object|null $data レスポンスデータ
     * @param int $statusCode HTTPステータスコード
     * @return Response JSONレスポンス
     */
    protected function respondWithData($data = null, int $statusCode = 200): Response
    {
        $payload = new ActionPayload($statusCode, $data);

        return $this->respond($payload);
    }

    /**
     * JSONレスポンスの出力
     * ActionPayloadをJSON形式でシリアライズして返す
     * @param ActionPayload $payload レスポンスペイロード
     * @return Response JSONレスポンス
     */
    protected function respond(ActionPayload $payload): Response
    {
        $json = json_encode($payload, JSON_PRETTY_PRINT);
        $this->response->getBody()->write($json);

        return $this->response
                    ->withHeader('Content-Type', 'application/json')
                    ->withStatus($payload->getStatusCode());
    }
}
