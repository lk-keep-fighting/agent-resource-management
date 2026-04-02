import { ApiClient } from '../lib/client';
import { loadConfig, saveConfig } from '../lib/storage';
import { success, error, info } from '../lib/formatter';

export async function login(serverUrl: string, apiKey: string): Promise<void> {
  try {
    const client = new ApiClient(serverUrl);
    const loginRes = await client.login(apiKey);

    saveConfig({
      serverUrl,
      token: loginRes.token,
      user: loginRes.user,
    });

    success(`登录成功! 欢迎, ${loginRes.user.name}`);
  } catch (err) {
    error(`登录失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function logout(): Promise<void> {
  const config = loadConfig();
  if (config?.token) {
    config.token = undefined;
    config.user = undefined;
    saveConfig(config);
    success('已退出登录');
  } else {
    info('未登录');
  }
}

export async function getCurrentUser(): Promise<void> {
  const config = loadConfig();
  if (!config?.token) {
    error('未登录，请先运行 adk login');
    process.exit(1);
  }

  const client = new ApiClient(config.serverUrl, config.token);
  try {
    const user = await client.me();
    console.log(`当前用户: ${user.name} (${user.email})`);
  } catch (err) {
    error(`获取用户信息失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}