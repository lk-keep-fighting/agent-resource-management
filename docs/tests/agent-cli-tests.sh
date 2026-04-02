#!/bin/bash

BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_KEY="${TEST_API_KEY:-admin-api-key-1775132551672}"
CLI_CMD="${CLI_CMD:-bun run /Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-sdk/agent-skill-system/cli/src/main.ts}"
TESTS_PASSED=0
TESTS_FAILED=0
TEST_DIR="/tmp/adk-agent-test"

echo "=========================================="
echo "Agent CLI 测试套件"
echo "BASE_URL: $BASE_URL"
echo "CLI_CMD: $CLI_CMD"
echo "=========================================="

cleanup() {
  echo "清理测试环境..."
  rm -rf "$TEST_DIR"
  mkdir -p "$TEST_DIR"
}

setup() {
  cleanup
  echo "配置CLI服务端..."
  $CLI_CMD server set "$BASE_URL" 2>/dev/null || true
  echo "登录..."
  $CLI_CMD login "$BASE_URL" "$API_KEY" 2>/dev/null || true
}

pass() { TESTS_PASSED=$((TESTS_PASSED + 1)); }
fail() { TESTS_FAILED=$((TESTS_FAILED + 1)); }

assert_contains() {
  local output="$1"
  local expected="$2"
  local test_name="$3"
  if echo "$output" | grep -q "$expected"; then
    echo "✓ PASS: $test_name"
    pass
  else
    echo "✗ FAIL: $test_name"
    echo "  Expected to contain: $expected"
    echo "  Output: $output"
    fail
  fi
}

assert_not_contains() {
  local output="$1"
  local unexpected="$2"
  local test_name="$3"
  if ! echo "$output" | grep -q "$unexpected"; then
    echo "✓ PASS: $test_name"
    pass
  else
    echo "✗ FAIL: $test_name"
    echo "  Expected NOT to contain: $unexpected"
    echo "  Output: $output"
    fail
  fi
}

setup

echo ""
echo "--- Test 1: agent ls (list agents) ---"
OUTPUT=$($CLI_CMD agent ls 2>&1)
assert_contains "$OUTPUT" "Agent" "agent ls shows Agent text"
assert_not_contains "$OUTPUT" "Error" "agent ls has no errors"
echo "Output: $OUTPUT"

echo ""
echo "--- Test 2: agent search ---"
OUTPUT=$($CLI_CMD agent search "test" 2>&1)
if echo "$OUTPUT" | grep -q "找到"; then
  assert_contains "$OUTPUT" "Agent" "agent search shows result"
else
  assert_contains "$OUTPUT" "没有找到" "agent search handles empty result"
fi
echo "Output: $OUTPUT"

echo ""
echo "--- Test 3: agent info with no login ---"
rm -rf ~/.adk/config.json
OUTPUT=$($CLI_CMD agent ls 2>&1)
assert_contains "$OUTPUT" "未登录" "agent info without login shows not logged in"
echo "Output: $OUTPUT"

echo ""
echo "--- Test 4: Login and get agent info ---"
$CLI_CMD login "$BASE_URL" "$API_KEY" 2>/dev/null || true
OUTPUT=$($CLI_CMD agent ls 2>&1)
assert_contains "$OUTPUT" "Agent" "agent ls after login works"
echo "Output: $OUTPUT"

echo ""
echo "--- Test 5: Create an agent via API for download test ---"
AGENT_NAME="test-cli-agent-$(date +%s)"
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/v1/agents" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"name\": \"$AGENT_NAME\",
    \"description\": \"Agent created by CLI test\",
    \"prompt\": \"You are a test agent\"
  }")
AGENT_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created agent: $AGENT_NAME (ID: $AGENT_ID)"

if [ -n "$AGENT_ID" ]; then
  echo ""
  echo "--- Test 6: agent download ---"
  cd "$TEST_DIR"
  OUTPUT=$($CLI_CMD agent download "$AGENT_NAME" . 2>&1)
  if echo "$OUTPUT" | grep -q "已下载"; then
    echo "✓ PASS: agent download succeeds"
    pass
  else
    echo "✗ FAIL: agent download failed"
    echo "  Output: $OUTPUT"
    fail
  fi
  
  echo ""
  echo "--- Test 7: Downloaded agent folder structure ---"
  if [ -d "$TEST_DIR/$AGENT_NAME" ]; then
    echo "✓ PASS: Agent folder created"
    pass
  else
    echo "✗ FAIL: Agent folder not created"
    fail
  fi
  
  if [ -f "$TEST_DIR/$AGENT_NAME/AGENTS.md" ]; then
    echo "✓ PASS: AGENTS.md exists"
    pass
  else
    echo "✗ FAIL: AGENTS.md not found"
    fail
  fi
  
  if [ -d "$TEST_DIR/$AGENT_NAME/skills" ]; then
    echo "✓ PASS: skills directory exists"
    pass
  else
    echo "✗ FAIL: skills directory not found"
    fail
  fi
  
  if [ -d "$TEST_DIR/$AGENT_NAME/knowledges" ]; then
    echo "✓ PASS: knowledges directory exists"
    pass
  else
    echo "✗ FAIL: knowledges directory not found"
    fail
  fi
  
  echo ""
  echo "--- Test 8: AGENTS.md content check ---"
  if grep -q "name: $AGENT_NAME" "$TEST_DIR/$AGENT_NAME/AGENTS.md"; then
    echo "✓ PASS: AGENTS.md contains correct name"
    pass
  else
    echo "✗ FAIL: AGENTS.md missing correct name"
    fail
  fi
  
  if grep -q "version:" "$TEST_DIR/$AGENT_NAME/AGENTS.md"; then
    echo "✓ PASS: AGENTS.md contains version"
    pass
  else
    echo "✗ FAIL: AGENTS.md missing version"
    fail
  fi
  
  if grep -q "System Prompt" "$TEST_DIR/$AGENT_NAME/AGENTS.md"; then
    echo "✓ PASS: AGENTS.md contains System Prompt"
    pass
  else
    echo "✗ FAIL: AGENTS.md missing System Prompt"
    fail
  fi
  
  echo ""
  echo "--- Cleanup: Delete test agent ---"
  curl -s -X DELETE "$BASE_URL/api/v1/agents/$AGENT_ID" \
    -H "Authorization: Bearer $API_KEY" > /dev/null
fi

echo ""
echo "--- Test 9: agent info with invalid agent ---"
OUTPUT=$($CLI_CMD agent info "non-existent-agent-xyz" 2>&1)
if echo "$OUTPUT" | grep -q "不存在"; then
  echo "✓ PASS: info non-existent agent shows error"
  pass
else
  echo "✗ FAIL: info non-existent agent should show error"
  echo "  Output: $OUTPUT"
  fail
fi

echo ""
echo "=========================================="
echo "测试结果: $TESTS_PASSED 通过, $TESTS_FAILED 失败"
echo "=========================================="

cleanup
if [ $TESTS_FAILED -gt 0 ]; then
  exit 1
fi
exit 0