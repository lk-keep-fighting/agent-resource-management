import { loadConfig, saveConfig } from './storage';

export type OutputMode = 'json' | 'text';

export interface JsonResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export function outputJson<T>(result: JsonResult<T>): void {
  console.log(JSON.stringify(result, null, 2));
}

export function shouldOutputJson(): boolean {
  if (process.argv.includes('--json') || process.argv.includes('-j')) {
    return true;
  }
  const config = loadConfig();
  return config.outputMode !== 'text';
}

export function getOutputMode(): OutputMode {
  const config = loadConfig();
  return config.outputMode || 'json';
}

export function setOutputMode(mode: OutputMode): void {
  const config = loadConfig() || {};
  config.outputMode = mode;
  saveConfig(config);
}