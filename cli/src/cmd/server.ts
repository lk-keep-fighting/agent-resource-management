import { getServerUrl, setServerUrl } from '../lib/storage';
import { info } from '../lib/formatter';

export function showServer(): void {
  info(`当前服务端: ${getServerUrl()}`);
}

export function setServer(url: string): void {
  setServerUrl(url);
  info(`已设置服务端: ${url}`);
}