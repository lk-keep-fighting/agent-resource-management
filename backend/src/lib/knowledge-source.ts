import prisma from '@/lib/db';

export interface ExternalKnowledgeSource {
  id: string;
  name: string;
  description: string | null;
  status: string;
  endpoint: string;
  authType: string;
  authHeader: string | null;
  authValue: string | null;
  idField: string;
  titleField: string;
  contentField: string;
  descField: string | null;
  updatedField: string | null;
  contentType: string;
  method: string;
  headers: Record<string, string> | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

export interface ExternalKnowledge {
  id: string;
  name: string;
  title?: string;
  description: string;
  content: string;
  createdAt?: string;
  updatedAt?: string;
  sourceId: string;
  sourceName: string;
}

export interface FetchFromSourceOptions {
  keyword?: string;
  page?: number;
  pageSize?: number;
}

export async function fetchExternalSources(): Promise<ExternalKnowledgeSource[]> {
  const sources = await prisma.externalKnowledgeSource.findMany({
    where: { status: 'active' },
    orderBy: { createdAt: 'desc' },
  });
  return sources.map((s) => ({
    ...s,
    headers: (s.headers as Record<string, string>) || null,
  })) as ExternalKnowledgeSource[];
}

export async function fetchExternalSourceById(id: string): Promise<ExternalKnowledgeSource | null> {
  const source = await prisma.externalKnowledgeSource.findUnique({
    where: { id },
  });
  if (!source) return null;
  return {
    ...source,
    headers: (source.headers as Record<string, string>) || null,
  } as ExternalKnowledgeSource;
}

export async function fetchFromExternalSource(
  source: ExternalKnowledgeSource,
  options: FetchFromSourceOptions = {}
): Promise<{ knowledges: ExternalKnowledge[]; total: number }> {
  const params = new URLSearchParams();
  if (options.keyword) params.set('search', options.keyword);
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('pageSize', String(options.pageSize));

  const url = params.toString() ? `${source.endpoint}?${params.toString()}` : source.endpoint;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(source.headers as Record<string, string> || {}),
  };

  if (source.authType === 'api_key' && source.authHeader && source.authValue) {
    headers[source.authHeader] = source.authValue;
  } else if (source.authType === 'bearer' && source.authValue) {
    headers['Authorization'] = `Bearer ${source.authValue}`;
  } else if (source.authType === 'basic' && source.authValue) {
    headers['Authorization'] = `Basic ${source.authValue}`;
  }

  const response = await fetch(url, {
    method: source.method || 'GET',
    headers,
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch from external source: ${response.statusText}`);
  }

  const data = await response.json();
  const rawKnowledges = Array.isArray(data) ? data : data.knowledge || data.documents || data.items || [];

  const knowledges: ExternalKnowledge[] = rawKnowledges.map((k: any) => {
    const id = k[source.idField] || k.id || k._id;
    const title = k[source.titleField] || k.title || k.name || '未知知识';
    const description = source.descField ? (k[source.descField] || '') : (k.description || k.desc || '');
    let content = k[source.contentField] || k.content || '';

    if (source.contentType === 'html') {
      content = convertHtmlToMarkdown(content);
    }

    return {
      id: String(id),
      name: title,
      title,
      description,
      content,
      createdAt: k.createdAt || k.createTime,
      updatedAt: k.updatedAt || k.updateTime || k[source.updatedField || ''],
      sourceId: source.id,
      sourceName: source.name,
    };
  });

  return {
    knowledges,
    total: knowledges.length,
  };
}

function convertHtmlToMarkdown(html: string): string {
  if (!html || typeof html !== 'string') return html;
  
  let markdown = html;
  markdown = markdown.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n');
  markdown = markdown.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n');
  markdown = markdown.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n');
  markdown = markdown.replace(/<h4[^>]*>(.*?)<\/h4>/gi, '#### $1\n');
  markdown = markdown.replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n');
  markdown = markdown.replace(/<br\s*\/?>/gi, '\n');
  markdown = markdown.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  markdown = markdown.replace(/<[^>]+>/g, '');
  markdown = markdown.replace(/&nbsp;/g, ' ');
  markdown = markdown.replace(/&amp;/g, '&');
  markdown = markdown.replace(/&lt;/g, '<');
  markdown = markdown.replace(/&gt;/g, '>');
  markdown = markdown.replace(/&quot;/g, '"');
  
  return markdown.trim();
}

export async function testExternalSource(
  source: ExternalKnowledgeSource
): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(source.headers as Record<string, string> || {}),
    };

    if (source.authType === 'api_key' && source.authHeader && source.authValue) {
      headers[source.authHeader] = source.authValue;
    } else if (source.authType === 'bearer' && source.authValue) {
      headers['Authorization'] = `Bearer ${source.authValue}`;
    } else if (source.authType === 'basic' && source.authValue) {
      headers['Authorization'] = `Basic ${source.authValue}`;
    }

    const response = await fetch(source.endpoint, {
      method: source.method || 'GET',
      headers,
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        success: false,
        message: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const data = await response.json();
    const rawData = Array.isArray(data) ? data : data.knowledge || data.documents || data.items || data;

    return {
      success: true,
      message: '连接成功',
      data: {
        itemCount: Array.isArray(rawData) ? rawData.length : 'N/A',
        sample: Array.isArray(rawData) ? rawData[0] : rawData,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      message: err.message || '连接失败',
    };
  }
}

export async function createExternalSource(
  data: {
    name: string;
    description?: string;
    endpoint: string;
    authType?: string;
    authHeader?: string;
    authValue?: string;
    idField?: string;
    titleField?: string;
    contentField?: string;
    descField?: string;
    updatedField?: string;
    contentType?: string;
    method?: string;
    headers?: Record<string, string>;
  },
  userId: string
): Promise<ExternalKnowledgeSource> {
  const source = await prisma.externalKnowledgeSource.create({
    data: {
      name: data.name,
      description: data.description || null,
      endpoint: data.endpoint,
      authType: data.authType || 'none',
      authHeader: data.authHeader || null,
      authValue: data.authValue || null,
      idField: data.idField || 'id',
      titleField: data.titleField || 'title',
      contentField: data.contentField || 'content',
      descField: data.descField || null,
      updatedField: data.updatedField || null,
      contentType: data.contentType || 'markdown',
      method: data.method || 'GET',
      headers: data.headers ?? undefined,
      createdBy: userId,
    },
  });
  return {
    ...source,
    headers: (source.headers as Record<string, string>) || null,
  } as ExternalKnowledgeSource;
}

export async function updateExternalSource(
  id: string,
  data: Partial<{
    name: string;
    description: string;
    status: string;
    endpoint: string;
    authType: string;
    authHeader: string;
    authValue: string;
    idField: string;
    titleField: string;
    contentField: string;
    descField: string;
    updatedField: string;
    contentType: string;
    method: string;
    headers: Record<string, string>;
  }>
): Promise<ExternalKnowledgeSource | null> {
  const updateData: any = { ...data };
  if (data.headers === undefined) {
    delete updateData.headers;
  }

  const source = await prisma.externalKnowledgeSource.update({
    where: { id },
    data: updateData,
  });
  return {
    ...source,
    headers: (source.headers as Record<string, string>) || null,
  } as ExternalKnowledgeSource;
}

export async function deleteExternalSource(id: string): Promise<boolean> {
  try {
    await prisma.externalKnowledgeSource.delete({
      where: { id },
    });
    return true;
  } catch {
    return false;
  }
}