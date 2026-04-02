#!/bin/bash

BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_KEY="${TEST_API_KEY:-admin-api-key-1775132551672}"
TESTS_PASSED=0
TESTS_FAILED=0

pass() { TESTS_PASSED=$((TESTS_PASSED + 1)); }
fail() { TESTS_FAILED=$((TESTS_FAILED + 1)); }

echo "=========================================="
echo "Agent API 测试套件"
echo "BASE_URL: $BASE_URL"
echo "=========================================="

auth() {
  curl -s -H "Authorization: Bearer $API_KEY" -H "Content-Type: application/json" "$@"
}

assert_contains() {
  local response="$1"
  local expected="$2"
  local test_name="$3"
  if echo "$response" | grep -q "$expected"; then
    echo "✓ PASS: $test_name"
    pass
  else
    echo "✗ FAIL: $test_name"
    echo "  Expected to contain: $expected"
    echo "  Response: $response"
    fail
  fi
}

assert_not_contains() {
  local response="$1"
  local unexpected="$2"
  local test_name="$3"
  if ! echo "$response" | grep -q "$unexpected"; then
    echo "✓ PASS: $test_name"
    pass
  else
    echo "✗ FAIL: $test_name"
    echo "  Expected NOT to contain: $unexpected"
    echo "  Response: $response"
    fail
  fi
}

assert_json_field() {
  local response="$1"
  local field="$2"
  local expected="$3"
  local test_name="$4"
  local actual
  actual=$(echo "$response" | grep -o "\"$field\":[^,}]*" | head -1 | sed 's/.*:\s*"\?\([^"]*\)"\?/\1/' | tr -d ' ')
  if [[ "$actual" == *"$expected"* ]]; then
    echo "✓ PASS: $test_name"
    pass
  else
    echo "✗ FAIL: $test_name"
    echo "  Field: $field"
    echo "  Expected to contain: $expected"
    echo "  Actual: $actual"
    fail
  fi
}

echo ""
echo "--- Test 1: List Agents ---"
RESPONSE=$(auth "$BASE_URL/api/v1/agents")
assert_contains "$RESPONSE" '"ok":true' "List agents returns ok"
assert_contains "$RESPONSE" '"agents"' "Response contains agents array"
echo "Response: $RESPONSE"

echo ""
echo "--- Test 2: Search Agents ---"
RESPONSE=$(auth "$BASE_URL/api/v1/agents?keyword=test")
assert_contains "$RESPONSE" '"ok":true' "Search agents returns ok"
echo "Response: $RESPONSE"

echo ""
echo "--- Test 3: Create Agent ---"
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/v1/agents" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-agent-'$(date +%s)'",
    "description": "Test agent for API testing",
    "prompt": "You are a test agent"
  }')
assert_contains "$CREATE_RESP" '"ok":true' "Create agent returns ok"
AGENT_ID=$(echo "$CREATE_RESP" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "Created agent ID: $AGENT_ID"
echo "Response: $CREATE_RESP"

if [ -n "$AGENT_ID" ]; then
  echo ""
  echo "--- Test 4: Get Agent Detail ---"
  RESPONSE=$(auth "$BASE_URL/api/v1/agents/$AGENT_ID")
  assert_contains "$RESPONSE" '"ok":true' "Get agent returns ok"
  assert_contains "$RESPONSE" '"version"' "Agent response contains version field"
  assert_json_field "$RESPONSE" "name" "test-agent-" "Agent name is set"
  echo "Response: $RESPONSE"

  echo ""
  echo "--- Test 5: Download Agent (zip) ---"
  HTTP_CODE=$(curl -s -o /tmp/agent-download.zip -w "%{http_code}" "$BASE_URL/api/v1/agents/$AGENT_ID/download" \
    -H "Authorization: Bearer $API_KEY")
  if [ "$HTTP_CODE" = "200" ]; then
    echo "✓ PASS: Download agent returns 200"
    pass
  else
    echo "✗ FAIL: Download agent returns $HTTP_CODE"
    fail
  fi
  
  if file /tmp/agent-download.zip | grep -q "Zip archive"; then
    echo "✓ PASS: Downloaded file is a zip"
    pass
  else
    echo "✗ FAIL: Downloaded file is not a zip"
    fail
  fi

  echo ""
  echo "--- Test 6: Agent version in download header ---"
  VERSION_HEADER=$(curl -s -I "$BASE_URL/api/v1/agents/$AGENT_ID/download" \
    -H "Authorization: Bearer $API_KEY" | grep -i "X-Version:" | tr -d '\r')
  if [ -n "$VERSION_HEADER" ]; then
    echo "✓ PASS: X-Version header present: $VERSION_HEADER"
    pass
  else
    echo "✗ FAIL: X-Version header missing"
    fail
  fi

  echo ""
  echo "--- Test 7: Delete Agent ---"
  DELETE_RESP=$(curl -s -X DELETE "$BASE_URL/api/v1/agents/$AGENT_ID" \
    -H "Authorization: Bearer $API_KEY")
  assert_contains "$DELETE_RESP" '"ok":true' "Delete agent returns ok"
fi

echo ""
echo "--- Test 8: Get non-existent Agent ---"
RESPONSE=$(auth "$BASE_URL/api/v1/agents/non-existent-id-12345")
assert_contains "$RESPONSE" '"ok":false' "Get non-existent agent returns not ok"

echo ""
echo "--- Test 9: Create Agent without auth ---"
CREATE_RESP=$(curl -s -X POST "$BASE_URL/api/v1/agents" \
  -H "Content-Type: application/json" \
  -d '{"name":"test","prompt":"test"}')
assert_contains "$CREATE_RESP" '"ok":false' "Create without auth returns not ok"

echo ""
echo "--- Test 10: Version field in list response ---"
RESPONSE=$(auth "$BASE_URL/api/v1/agents")
if echo "$RESPONSE" | grep -q '"version"'; then
  echo "✓ PASS: Agents list contains version field"
  pass
else
  echo "✗ FAIL: Agents list missing version field"
  fail
fi

echo ""
echo "=========================================="
echo "测试结果: $TESTS_PASSED 通过, $TESTS_FAILED 失败"
echo "=========================================="

if [ $TESTS_FAILED -gt 0 ]; then
  exit 1
fi
exit 0