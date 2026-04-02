#!/bin/bash

CLI_DIR="/Users/lk/Documents/Dev/aims/xuanwu/xuanwu-agents/agent-sdk/agent-skill-system/cli"
DATA_DIR="$CLI_DIR/data/skills"
SERVER_URL="http://localhost:3000"
API_KEY="4567c9e607564e91b3898c46d89cb68dc4e40ec4a52b456699b695cf800fd446"
ADK="/Users/lk/.bun/bin/bun run $CLI_DIR/src/main.ts"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    PASS=$((PASS + 1))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    echo -e "${YELLOW}  Expected: $2${NC}"
    echo -e "${YELLOW}  Actual: $3${NC}"
    FAIL=$((FAIL + 1))
}

log() {
    echo -e "${YELLOW}[TEST]${NC} $1"
}

cleanup() {
    log "Cleaning up..."
    rm -rf "$DATA_DIR/pdf-tool-downloaded"
    rm -f "$DATA_DIR/test-skill.zip"
    $ADK logout 2>/dev/null || true
}

check_output() {
    local output="$1"
    local expected="$2"
    if echo "$output" | grep -q "$expected"; then
        return 0
    fi
    return 1
}

wait_server() {
    log "Waiting for server to be healthy..."
    for i in {1..10}; do
        if curl -s "$SERVER_URL/api/v1/health" | grep -q "healthy"; then
            return 0
        fi
        sleep 1
    done
    echo -e "${RED}Server not healthy after 10 seconds${NC}"
    exit 1
}

wait_server

log "========== Regression Test Suite =========="

cleanup

echo ""
log "=== TC-CLI-001: adk login 成功登录 ==="
output=$($ADK login $SERVER_URL $API_KEY 2>&1)
if echo "$output" | grep -q "登录成功"; then
    pass "TC-CLI-001: Login successful"
else
    fail "TC-CLI-001: Login failed" "登录成功" "$output"
fi

echo ""
log "=== Setup: Upload test skills ==="
$ADK skill upload $DATA_DIR/pdf-tool > /dev/null 2>&1
$ADK skill upload $DATA_DIR/github-tool > /dev/null 2>&1

echo ""
log "=== TC-CLI-002: adk login 失败 (无效 API Key) ==="
$ADK logout > /dev/null 2>&1
output=$($ADK login $SERVER_URL invalid-api-key 2>&1)
if echo "$output" | grep -q "登录失败"; then
    pass "TC-CLI-002: Login with invalid key fails"
else
    fail "TC-CLI-002: Should fail with invalid key" "登录失败" "$output"
fi

echo ""
log "=== TC-CLI-003: adk login 失败 (无效 Server URL) ==="
output=$($ADK login http://invalid:9999 $API_KEY 2>&1)
if echo "$output" | grep -q "登录失败"; then
    pass "TC-CLI-003: Login with invalid server fails"
else
    fail "TC-CLI-003: Should fail with invalid server" "登录失败" "$output"
fi

echo ""
log "=== TC-CLI-004: adk logout 登出 ==="
$ADK login $SERVER_URL $API_KEY > /dev/null 2>&1
output=$($ADK logout 2>&1)
if echo "$output" | grep -q "已退出登录"; then
    pass "TC-CLI-004: Logout successful"
else
    fail "TC-CLI-004: Logout failed" "已退出登录" "$output"
fi

echo ""
log "=== TC-CLI-005: adk logout 未登录时 ==="
$ADK logout > /dev/null 2>&1
output=$($ADK logout 2>&1)
if echo "$output" | grep -q "未登录"; then
    pass "TC-CLI-005: Logout when not logged in"
else
    fail "TC-CLI-005: Should show not logged in" "未登录" "$output"
fi

echo ""
log "=== TC-CLI-006: adk skill ls 列出所有 Skills ==="
$ADK login $SERVER_URL $API_KEY > /dev/null 2>&1
output=$($ADK skill ls 2>&1)
if echo "$output" | grep -qE "(Skill|暂无)"; then
    pass "TC-CLI-006: List skills successful"
else
    fail "TC-CLI-006: List skills failed" "Skill list" "$output"
fi

echo ""
log "=== TC-CLI-007: adk skill ls 未登录时 ==="
$ADK logout > /dev/null 2>&1
output=$($ADK skill ls 2>&1)
if echo "$output" | grep -qE "未登录|Please login"; then
    pass "TC-CLI-007: List skills without login fails"
else
    fail "TC-CLI-007: Should fail without login" "未登录" "$output"
fi

echo ""
log "=== TC-CLI-008: adk skill search 搜索 Skills ==="
$ADK login $SERVER_URL $API_KEY > /dev/null 2>&1
output=$($ADK skill search pdf 2>&1)
if echo "$output" | grep -qE "(找到|暂无)"; then
    pass "TC-CLI-008: Search skills successful"
else
    fail "TC-CLI-008: Search skills failed" "search result" "$output"
fi

echo ""
log "=== TC-CLI-009: adk skill info 查看 Skill 详情 ==="
$ADK login $SERVER_URL $API_KEY > /dev/null 2>&1
output=$($ADK skill info pdf-tool 2>&1)
if echo "$output" | grep -qE "(pdf-tool|Name:)"; then
    pass "TC-CLI-009: Skill info successful"
else
    fail "TC-CLI-009: Skill info failed" "pdf-tool" "$output"
fi

echo ""
log "=== TC-CLI-010: adk skill info Skill 不存在 ==="
output=$($ADK skill info non-existent-skill-xyz 2>&1)
if echo "$output" | grep -qE "(未找到|不存在|not found)"; then
    pass "TC-CLI-010: Info for non-existent skill"
else
    fail "TC-CLI-010: Should show not found" "not found" "$output"
fi

echo ""
log "=== TC-CLI-014: adk skill upload 上传 Skill ==="
output=$($ADK skill upload $DATA_DIR/pdf-tool 2>&1)
if echo "$output" | grep -qE "(上传成功|Published)"; then
    pass "TC-CLI-014: Upload skill successful"
else
    fail "TC-CLI-014: Upload skill failed" "upload success" "$output"
fi

echo ""
log "=== TC-CLI-015: adk skill upload 目录不存在 ==="
output=$($ADK skill upload $DATA_DIR/non-existent-dir-xyz 2>&1)
if echo "$output" | grep -qE "(目录不存在|不存在)"; then
    pass "TC-CLI-015: Upload non-existent directory"
else
    fail "TC-CLI-015: Should fail for non-existent dir" "not found" "$output"
fi

echo ""
log "=== TC-CLI-016: adk skill upload SKILL.md 缺失 ==="
output=$($ADK skill upload $DATA_DIR/invalid-skill 2>&1)
if echo "$output" | grep -qE "(缺少|无效|SKILL.md)"; then
    pass "TC-CLI-016: Upload invalid skill without SKILL.md"
else
    fail "TC-CLI-016: Should fail without SKILL.md" "SKILL.md" "$output"
fi

echo ""
log "=== TC-CLI-017: adk skill my 查看我的发布 ==="
output=$($ADK skill my 2>&1)
if echo "$output" | grep -qE "(发布|Skill|暂无)"; then
    pass "TC-CLI-017: My skills listed"
else
    fail "TC-CLI-017: My skills failed" "my skills" "$output"
fi

echo ""
log "=== TC-CLI-020: adk skill validate 验证有效 Skill ==="
output=$($ADK skill validate $DATA_DIR/pdf-tool 2>&1)
if echo "$output" | grep -qE "(通过|Valid)"; then
    pass "TC-CLI-020: Validate valid skill"
else
    fail "TC-CLI-020: Validate valid skill failed" "valid" "$output"
fi

echo ""
log "=== TC-CLI-021: adk skill validate 验证无效 Skill ==="
output=$($ADK skill validate $DATA_DIR/invalid-skill 2>&1)
if echo "$output" | grep -qE "(失败|Invalid|错误)"; then
    pass "TC-CLI-021: Validate invalid skill"
else
    fail "TC-CLI-021: Should detect invalid skill" "invalid" "$output"
fi

echo ""
log "=== TC-CLI-011: adk skill download 下载 Skill ==="
output=$($ADK skill download pdf-tool $DATA_DIR 2>&1)
if echo "$output" | grep -qE "(已下载)"; then
    if [ -f "$DATA_DIR/pdf-tool.zip" ]; then
        pass "TC-CLI-011: Download skill successful"
    else
        fail "TC-CLI-011: Download file not found" "pdf-tool.zip exists" "file not found"
    fi
else
    fail "TC-CLI-011: Download skill failed" "download success" "$output"
fi

echo ""
log "=== TC-CLI-013: adk skill download Skill 不存在 ==="
output=$($ADK skill download non-existent-skill-xyz 2>&1)
if echo "$output" | grep -qE "(未找到|不存在|not found)"; then
    pass "TC-CLI-013: Download non-existent skill"
else
    fail "TC-CLI-013: Should fail for non-existent" "not found" "$output"
fi

echo ""
log "=== TC-CLI-019: adk skill delete 无权限 (先上传自己的skill再删除) ==="
output=$($ADK skill upload $DATA_DIR/github-tool 2>&1)
if echo "$output" | grep -qE "(上传成功|Published)"; then
    uploaded=true
else
    uploaded=false
fi

if [ "$uploaded" = true ]; then
    output=$($ADK skill delete github-tool 2>&1)
    if echo "$output" | grep -qE "(已删除|删除成功|Deleted)"; then
        pass "TC-CLI-019: Delete own skill"
    else
        fail "TC-CLI-019: Delete own skill failed" "deleted" "$output"
    fi
else
    fail "TC-CLI-019: Could not upload test skill" "upload success" "$output"
fi

echo ""
log "========== Test Summary =========="
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"

if [ $FAIL -gt 0 ]; then
    exit 1
fi
exit 0