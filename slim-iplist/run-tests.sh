#!/bin/bash
# slim-iplist テスト実行スクリプト（Docker内実行用）
# 
# 使い方:
#   ./run-tests.sh              # 全テスト実行
#   ./run-tests.sh unit         # ユニットテストのみ
#   ./run-tests.sh integration  # 統合テストのみ
#   ./run-tests.sh functional   # 機能テストのみ

set -e

# スクリプトのディレクトリを取得
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Dockerコンテナ名を取得（docker-composeのサービス名から）
CONTAINER_NAME="ip_allocation_search-web-1"

# コンテナが実行中かチェック
if ! docker ps --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Error: Docker container '${CONTAINER_NAME}' is not running."
    echo "Please start it with: docker compose up -d web"
    exit 1
fi

# テスト種別を取得
TEST_SUITE="${1:-all}"

echo "=================================================="
echo "slim-iplist Test Runner (Docker Mode)"
echo "=================================================="
echo "Container: ${CONTAINER_NAME}"
echo "Test Suite: ${TEST_SUITE}"
echo "=================================================="
echo ""

# Composer依存関係のインストール確認
echo "Checking Composer dependencies..."
docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && composer install --quiet --no-interaction"

# Docker環境用の環境変数（docker-composeのlinksを使用）
ENV_VARS=(
    "DB_HOST=mysql_db"
    "DB_PORT=3306"
    "DB_USER=root"
    "DB_PASSWORD=passwd"
    "DB_NAME=test_db"
)

ENV_STRING="${ENV_VARS[*]}"

# テスト実行
case "${TEST_SUITE}" in
    unit)
        echo "Running Unit Tests (no database required)..."
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && vendor/bin/phpunit --testsuite=Unit"
        ;;
    integration)
        echo "Running Integration Tests (database required)..."
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && ${ENV_STRING} vendor/bin/phpunit --testsuite=Integration"
        ;;
    functional)
        echo "Running Functional Tests (database required)..."
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && ${ENV_STRING} vendor/bin/phpunit --testsuite=Functional"
        ;;
    check)
        echo "Running Code Quality Checks..."
        echo ""
        echo "1. PHP CodeSniffer..."
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && composer cs-check" || true
        echo ""
        echo "2. PHPStan Static Analysis..."
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && composer phpstan" || true
        ;;
    all|*)
        echo "Running All Tests..."
        echo ""
        echo "=== Unit Tests ==="
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && vendor/bin/phpunit --testsuite=Unit"
        echo ""
        echo "=== Integration Tests ==="
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && ${ENV_STRING} vendor/bin/phpunit --testsuite=Integration"
        echo ""
        echo "=== Functional Tests ==="
        docker exec "${CONTAINER_NAME}" bash -c "cd /var/www/web && ${ENV_STRING} vendor/bin/phpunit --testsuite=Functional"
        ;;
esac

echo ""
echo "=================================================="
echo "Test execution completed!"
echo "=================================================="
