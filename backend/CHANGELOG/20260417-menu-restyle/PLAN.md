# 菜单与布局重构计划

## 目标
实施方案二：市场聚合 + 个人中心整合

## 变更内容

### 1. 新建 /market 页面
- 合并 Skill 市场 和 知识市场
- 路径: `src/app/(dashboard)/market/page.tsx`

### 2. 新建 /my 页面
- 合并"我的发布"和"设置"
- 路径: `src/app/(dashboard)/my/page.tsx`

### 3. 更新导航菜单
- 修改 `layout.tsx` 中的 `baseNavItems`
- 新菜单结构:
  - /agents - Agent 管理
  - /market - 市场
  - /my - 我的

### 4. 路由调整
- 保留原页面但重定向到新页面（或保持兼容）

## 执行步骤
1. [ ] 创建 market 页面
2. [ ] 创建 my 页面
3. [ ] 更新 layout.tsx 导航
4. [ ] 添加路由重定向（可选，保持兼容性）
