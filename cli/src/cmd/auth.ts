import { ApiClient } from '../lib/client';
import { loadConfig, saveConfig } from '../lib/storage';
import { success, error, info } from '../lib/formatter';

export async function register(name?: string, email?: string, password?: string): Promise<void> {
  const { readline } = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const ask = (question: string): Promise<string> =>
    new Promise((resolve) => rl.question(question, resolve));

  let finalEmail = email;
  let finalPassword = password;
  let finalName = name;

  if (!finalEmail) {
    finalEmail = await ask('请输入邮箱: ');
  }
  if (!finalPassword) {
    finalPassword = await ask('请输入密码: ');
  }
  if (!finalName) {
    finalName = await ask('请输入用户名: ');
  }
  rl.close();

  if (!finalEmail || !finalPassword || !finalName) {
    error('邮箱、密码和用户名都不能为空');
    process.exit(1);
  }

  if (finalPassword.length < 8) {
    error('密码至少需要 8 个字符');
    process.exit(1);
  }

  const config = loadConfig();
  const serverUrl = config?.serverUrl || 'http://localhost:3000';
  const client = new ApiClient(serverUrl);

  try {
    const result = await client.register(finalEmail, finalPassword, finalName);
    saveConfig({
      serverUrl,
      token: result.token,
      user: result.user,
    });
    success(`注册成功! 欢迎, ${result.user.name}`);
  } catch (err) {
    error(`注册失败: ${err instanceof Error ? err.message : '未知错误'}`);
    process.exit(1);
  }
}

export async function login(): Promise<void> {
  console.log('请在浏览器打开：' + (loadConfig()?.serverUrl || 'http://localhost:3000') + '/settings/tokens');
  console.log('生成一个 PAT（建议命名包含机器名），复制粘贴到此处：');
  const { readline } = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const token = await new Promise<string>((resolve) => rl.question('PAT> ', (a) => { rl.close(); resolve(a); }));
  const trimmed = token.trim();
  if (!trimmed.startsWith('arm_pat_')) {
    error('格式错误：应以 arm_pat_ 开头');
    process.exit(1);
  }

  const config = loadConfig() || { serverUrl: 'http://localhost:3000' };
  config.serverUrl = config.serverUrl || 'http://localhost:3000';
  config.token = trimmed;
  saveConfig(config);

  // 顺便用这个 token 拉一次用户信息
  const client = new ApiClient(config.serverUrl, trimmed);
  try {
    const me = await client.me();
    config.user = { id: me.id, name: me.name, email: me.email };
    saveConfig(config);
    success(`登录成功! 欢迎, ${me.name}`);
  } catch (e) {
    error(`Token 无效：${e instanceof Error ? e.message : e}`);
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
    error('未登录，请先运行 arm login');
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
