import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Agent Skill System',
  description: 'Agent Skill Management Platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}