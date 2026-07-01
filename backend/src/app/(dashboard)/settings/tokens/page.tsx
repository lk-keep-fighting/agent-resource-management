import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import prisma from '@/lib/db';
import { hashPAT } from '@/lib/auth';
import TokensPanel from '@/components/settings/tokens-panel';

export const dynamic = 'force-dynamic';

export default async function TokensPage() {
  const cookieStore = cookies();
  const pat = cookieStore.get('arm_pat')?.value;
  if (!pat) redirect('/login');

  const tokenHash = hashPAT(pat);
  const sessionToken = await prisma.userToken.findUnique({
    where: { tokenHash },
  });
  if (!sessionToken) redirect('/login');

  const rows = await prisma.userToken.findMany({
    where: { userId: sessionToken.userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, name: true, expiresAt: true, lastUsedAt: true, createdAt: true,
    },
  });

  const tokens = rows.map((t) => ({
    id: t.id,
    name: t.name,
    expiresAt: t.expiresAt ? t.expiresAt.toISOString() : null,
    lastUsedAt: t.lastUsedAt ? t.lastUsedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
  }));

  return <TokensPanel initialTokens={tokens} />;
}