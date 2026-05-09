import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const CONFIG_DIR = join(process.env.HOME || '/root', '.arm');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');

interface Config {
  serverUrl: string;
  token?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  outputMode?: 'json' | 'text';
}

function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function saveConfig(config: Config): void {
  ensureConfigDir();
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

export function loadConfig(): Config | null {
  try {
    ensureConfigDir();
    if (!existsSync(CONFIG_FILE)) {
      return null;
    }
    const content = readFileSync(CONFIG_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export function clearConfig(): void {
  try {
    if (existsSync(CONFIG_FILE)) {
      const content = readFileSync(CONFIG_FILE, 'utf-8');
      const config: Config = JSON.parse(content);
      config.token = undefined;
      config.user = undefined;
      saveConfig(config);
    }
  } catch {
  }
}

export function getServerUrl(): string {
  const config = loadConfig();
  return config?.serverUrl || 'http://localhost:3000';
}

export function setServerUrl(url: string): void {
  const config = loadConfig() || {};
  config.serverUrl = url;
  saveConfig(config);
}