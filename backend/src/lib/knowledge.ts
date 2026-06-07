import {
  fetchExternalSources,
  fetchExternalSourceById,
  fetchFromExternalSource,
} from './knowledge-source';

export interface Knowledge {
  id: string;
  name: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
  sourceId?: string;
  sourceName?: string;
}

export interface KnowledgeListResponse {
  knowledges: Knowledge[];
  total: number;
  page: number;
  pageSize: number;
}

export interface KnowledgeQuery {
  keyword?: string;
  search?: string;
  category?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
}

export async function fetchKnowledges(query: KnowledgeQuery = {}): Promise<KnowledgeListResponse> {
  const sources = await fetchExternalSources();

  const results = await Promise.allSettled([
    ...sources.map((s) => fetchFromExternalSource(s, query)),
  ]);

  const externalKnowledges: Knowledge[] = [];
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === 'fulfilled') {
      externalKnowledges.push(
        ...result.value.knowledges.map((k) => ({
          ...k,
          sourceId: sources[i].id,
          sourceName: sources[i].name,
        }))
      );
    }
  }

  return {
    knowledges: externalKnowledges,
    total: externalKnowledges.length,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
  };
}

export async function fetchKnowledgeById(id: string): Promise<Knowledge | null> {
  const prisma = require('@/lib/db').default;

  const localKnowledge = await prisma.knowledge.findUnique({
    where: { id },
  });

  if (localKnowledge) {
    return {
      id: localKnowledge.id,
      name: localKnowledge.name,
      description: localKnowledge.description || '',
      content: localKnowledge.content,
      createdAt: localKnowledge.createdAt.toISOString(),
      updatedAt: localKnowledge.updatedAt.toISOString(),
    };
  }

  const sources = await fetchExternalSources();
  for (const source of sources) {
    const result = await fetchFromExternalSource(source, {});
    const found = result.knowledges.find((k) => k.id === id);
    if (found) {
      return found;
    }
  }

  return null;
}

export async function fetchLocalKnowledges(query: { keyword?: string; tags?: string[]; tagMode?: string } = {}): Promise<{ knowledges: Knowledge[]; total: number }> {
  const prisma = require('@/lib/db').default;

  const where: any = {
    ...(query.keyword
      ? {
          OR: [
            { name: { contains: query.keyword } },
            { description: { contains: query.keyword } },
          ],
        }
      : {}),
    ...(query.tags && query.tags.length > 0
      ? {
          knowledgeTags:
            query.tagMode === 'and'
              ? { some: { tag: { name: { in: query.tags } } }, every: { tag: { name: { in: query.tags } } } }
              : { some: { tag: { name: { in: query.tags } } } },
        }
      : {}),
  };

  const [knowledges, total] = await Promise.all([
    prisma.knowledge.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        knowledgeTags: { include: { tag: true } },
        creator: { select: { id: true, name: true } },
      },
    }),
    prisma.knowledge.count({ where }),
  ]);

  return {
    knowledges: knowledges.map((k: any) => ({
      id: k.id,
      name: k.name,
      description: k.description || '',
      content: k.content,
      tags: k.knowledgeTags.map((kt: any) => kt.tag.name),
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
      creatorName: k.creator?.name ?? '未知',
    })),
    total,
  };
}

export async function fetchUserKnowledges(userId: string): Promise<Knowledge[]> {
  const prisma = require('@/lib/db').default;
  
  const knowledges = await prisma.knowledge.findMany({
    where: { createdBy: userId },
    orderBy: { createdAt: 'desc' },
  });

  return knowledges.map((k: any) => ({
    id: k.id,
    name: k.name,
    description: k.description || '',
    content: k.content,
    createdAt: k.createdAt.toISOString(),
    updatedAt: k.updatedAt.toISOString(),
  }));
}

export async function deleteKnowledge(id: string): Promise<boolean> {
  const prisma = require('@/lib/db').default;
  
  try {
    await prisma.knowledge.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}