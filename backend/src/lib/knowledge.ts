const MARKET_SERVICE_URL = process.env.MARKET_SERVICE_URL;
const MARKET_API_KEY = process.env.MARKET_API_KEY || 'market-dev-key-1';

export interface Knowledge {
  id: string;
  name: string;
  title?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  content?: string;
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
  if (!MARKET_SERVICE_URL) {
    throw new Error('MARKET_SERVICE_URL is not configured');
  }

  const params = new URLSearchParams({ api_key: MARKET_API_KEY });
  if (query.search) params.set('search', query.search);
  if (query.category) params.set('category', query.category);
  if (query.limit) params.set('limit', String(query.limit));
  if (query.page) params.set('page', String(query.page));
  if (query.pageSize) params.set('pageSize', String(query.pageSize));

  const url = `${MARKET_SERVICE_URL}/api/market/knowledge?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch knowledges: ${response.statusText}`);
  }

  const data = await response.json();
  const rawKnowledges = Array.isArray(data) ? data : data.knowledge || data.documents || [];
  
  const knowledges = rawKnowledges.map((k: any) => ({
    id: k.id || k._id,
    name: k.name || k.title || k.title || '未知知识',
    title: k.title,
    description: k.description || k.desc || '',
    content: k.content,
    createdAt: k.createdAt || k.createTime,
    updatedAt: k.updatedAt || k.updateTime,
  }));

  return {
    knowledges,
    total: knowledges.length,
    page: query.page || 1,
    pageSize: query.pageSize || 20,
  };
}

export async function fetchKnowledgeById(id: string): Promise<Knowledge | null> {
  if (!MARKET_SERVICE_URL) {
    throw new Error('MARKET_SERVICE_URL is not configured');
  }

  const params = new URLSearchParams({ api_key: MARKET_API_KEY, search: id, limit: '1' });

  const response = await fetch(`${MARKET_SERVICE_URL}/api/market/knowledge?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    next: { revalidate: 60 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch knowledge: ${response.statusText}`);
  }

  const data = await response.json();
  const knowledges = Array.isArray(data) ? data : data.knowledge || data.documents || [];

  return knowledges.find((k: any) => k.id === id || k.name === id || k.title === id) || null;
}