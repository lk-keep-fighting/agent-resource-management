#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_KEY="${TEST_API_KEY:-admin-api-key-1775132551672}"

echo "=========================================="
echo "Agent 功能测试套件"
echo "BASE_URL: $BASE_URL"
echo "=========================================="

cd "$SCRIPT_DIR"

echo ""
echo ">>> 启动后端服务 (如果未运行) <<<"
lsof -i :3000 | grep -q LISTEN || {
  echo "后端未运行，正在启动..."
  cd /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-sdk/agent-skill-system/backend
  pnpm dev > /tmp/backend-dev.log 2>&1 &
  sleep 5
  echo "后端已启动"
}

export API_BASE_URL
export TEST_API_KEY

echo ""
echo "=========================================="
echo "运行 API 测试"
echo "=========================================="
bash agent-api-tests.sh
API_RESULT=$?

echo ""
echo "=========================================="
echo "运行 CLI 测试"
echo "=========================================="
bash agent-cli-tests.sh
CLI_RESULT=$?

echo ""
echo "=========================================="
echo "测试结果汇总"
echo "=========================================="
if [ $API_RESULT -eq 0 ] && [ $CLI_RESULT -eq 0 ]; then
  echo "✓ 所有测试通过"
  exit 0
else
  echo "✗ 部分测试失败"
  [ $API_RESULT -ne 0 ] && echo "  - API 测试失败"
  [ $CLI_RESULT -ne 0 ] && echo "  - CLI 测试失败"
  exit 1
fi