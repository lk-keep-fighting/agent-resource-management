'use client';

import { useState } from 'react';

type Token = {
  id: string;
  name: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
};

export default function TokensPanel({ initialTokens }: { initialTokens: Token[] }) {
  const [tokens, setTokens] = useState(initialTokens);
  const [name, setName] = useState('');
  const [newlyCreatedToken, setNewlyCreatedToken] = useState<string | null>(null);

  const create = async () => {
    if (!name.trim()) return;
    const res = await fetch('/api/v1/tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim() }),
    });
    const j = await res.json();
    if (j.ok) {
      setNewlyCreatedToken(j.data.token);
      setTokens((t) => [{ id: j.data.id, name: j.data.name, expiresAt: j.data.expiresAt, lastUsedAt: null, createdAt: j.data.createdAt }, ...t]);
      setName('');
    } else {
      alert('创建失败: ' + j.msg);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm('确认撤销该 Token？撤销后使用此 Token 的客户端需重新登录。')) return;
    const res = await fetch(`/api/v1/tokens/${id}`, { method: 'DELETE' });
    const j = await res.json();
    if (j.ok) {
      setTokens((t) => t.filter((x) => x.id !== id));
    } else {
      alert('撤销失败: ' + j.msg);
    }
  };

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-bold mb-4">🔑 API Tokens</h1>

      <div className="mb-6 p-4 border rounded">
        <h2 className="font-semibold mb-2">生成新 Token</h2>
        <div className="flex gap-2">
          <input
            className="border rounded px-2 py-1 flex-1"
            placeholder="Token 用途（如：CLI on macbook）"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button className="bg-blue-500 text-white px-3 py-1 rounded" onClick={create}>
            生成
          </button>
        </div>
        {newlyCreatedToken && (
          <div className="mt-3 p-3 bg-yellow-50 border border-yellow-300 rounded">
            <div className="text-sm text-yellow-800 mb-1">⚠ 请立即保存，关闭后无法再次查看：</div>
            <code className="block bg-white p-2 rounded break-all">{newlyCreatedToken}</code>
            <button
              className="mt-2 text-sm text-blue-600"
              onClick={() => {
                navigator.clipboard.writeText(newlyCreatedToken);
                setNewlyCreatedToken(null);
              }}
            >
              复制并关闭
            </button>
          </div>
        )}
      </div>

      <h2 className="font-semibold mb-2">已有 Token</h2>
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left p-2">名称</th>
            <th className="text-left p-2">创建时间</th>
            <th className="text-left p-2">最后使用</th>
            <th className="text-left p-2">过期时间</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {tokens.map((t) => (
            <tr key={t.id} className="border-t">
              <td className="p-2">{t.name}</td>
              <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
              <td className="p-2">{t.lastUsedAt ? new Date(t.lastUsedAt).toLocaleString() : '从未'}</td>
              <td className="p-2">{t.expiresAt ? new Date(t.expiresAt).toLocaleString() : '永不过期'}</td>
              <td className="p-2">
                <button className="text-red-600" onClick={() => revoke(t.id)}>
                  撤销
                </button>
              </td>
            </tr>
          ))}
          {tokens.length === 0 && (
            <tr><td colSpan={5} className="p-4 text-center text-gray-500">暂无 Token</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}