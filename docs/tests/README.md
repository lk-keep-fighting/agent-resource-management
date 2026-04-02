# Agent 功能测试套件

## 测试文件

| 文件 | 说明 |
|------|------|
| `agent-api-tests.sh` | Backend Agent API 测试 |
| `agent-cli-tests.sh` | CLI Agent 命令测试 |
| `run-tests.sh` | 统一测试运行脚本 |

## 运行测试

### 方式1: 运行所有测试
```bash
cd docs/tests
./run-tests.sh
```

### 方式2: 分别运行
```bash
cd docs/tests
./agent-api-tests.sh    # API测试
./agent-cli-tests.sh     # CLI测试
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `API_BASE_URL` | http://localhost:3000 | 后端服务地址 |
| `TEST_API_KEY` | admin-api-key-1775132551672 | 测试用API Key |

## 测试覆盖

### API 测试 (14项)
- [x] 列出Agents
- [x] 搜索Agents  
- [x] 创建Agent
- [x] 获取Agent详情
- [x] 下载Agent (ZIP)
- [x] X-Version响应头
- [x] 删除Agent
- [x] 获取不存在的Agent
- [x] 无认证创建Agent
- [x] version字段存在性

### CLI 测试 (14项)
- [x] `adk agent ls` 列出Agents
- [x] `adk agent search` 搜索
- [x] 未登录时显示错误
- [x] 登录后可正常操作
- [x] `adk agent download` 下载
- [x] 文件夹结构正确
- [x] AGENTS.md 包含必要字段
- [x] 无效Agent显示错误

## 调试

如需单独调试某个测试：

```bash
# 查看CLI详细输出
bash -x agent-cli-tests.sh

# 测试特定API
curl -s http://localhost:3000/api/v1/agents \
  -H "Authorization: Bearer admin-api-key-1775132551672"
```
