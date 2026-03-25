const API = '/api';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

/** Exported for module endpoints (procurement, order-automation). */
export async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (token) (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  if (res.status === 401) {
    const refreshed = await refreshToken();
    if (refreshed) {
      (headers as Record<string, string>)['Authorization'] = `Bearer ${getToken()}`;
      const retry = await fetch(`${API}${path}`, { ...options, headers });
      if (!retry.ok) throw new Error(await retry.text());
      return retry.json();
    }
    throw new Error('Unauthorized');
  }
  if (!res.ok) {
    const text = await res.text();
    let err: { error?: string };
    try {
      err = JSON.parse(text);
    } catch {
      err = { error: text };
    }
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function refreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem('refreshToken');
  if (!refresh) return false;
  try {
    const data = await fetch(`${API}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    }).then((r) => r.json());
    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      return true;
    }
  } catch {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
  return false;
}

export const api = {
  auth: {
    login: (email: string, password: string) =>
      request<{ user: User; accessToken: string; refreshToken: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      }),
    loginWithOrg: (organizationSlug: string, email: string, password: string) =>
      request<{ user: User; organization?: { id: string; name: string; slug: string }; accessToken: string; refreshToken: string }>('/auth/login-org', {
        method: 'POST',
        body: JSON.stringify({ email, password, organizationSlug }),
      }),
    register: (email: string, password: string, role?: string) =>
      request<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, role: role || 'manager' }),
      }),
    registerOrg: (organizationName: string, slug: string, email: string, password: string, industry?: string) =>
      request<{ user: User; organization: { id: string; name: string; slug: string }; accessToken: string; refreshToken: string }>('/auth/register-org', {
        method: 'POST',
        body: JSON.stringify({ organizationName, slug, email, password, ...(industry ? { industry } : {}) }),
      }),
    logout: (refreshToken?: string) =>
      request<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
    me: () => request<{ user: User }>('/auth/me'),
  },
  suppliers: () => request<{ suppliers: Supplier[] }>('/suppliers'),
  supplier: {
    patch: (id: string, body: Partial<{
      contact_name: string | null;
      email: string | null;
      phone: string | null;
      notify_channel: string | null;
      is_active: boolean | null;
    }>) =>
      request<Supplier>(`/suppliers/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    filters: {
      list: (id: string) => request<{ filters: Array<{ id: string; keyword: string }> }>(`/suppliers/${id}/filters`),
      add: (id: string, keyword: string) =>
        request<{ id: string; keyword: string }>(`/suppliers/${id}/filters`, {
          method: 'POST',
          body: JSON.stringify({ keyword }),
        }),
      remove: (id: string, filterId: string) =>
        request<{ ok: boolean }>(`/suppliers/${id}/filters/${filterId}`, { method: 'DELETE' }),
    },
    invite: (id: string) => request<{ ok: boolean }>(`/suppliers/${id}/invite`, { method: 'POST' }),
  },
  products: () => request<{ products: Product[] }>('/products'),
  setPriority: (id: string, isPriority: boolean) =>
    request<{ ok: boolean }>(`/products/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ isPriority }),
    }),
  productNormalization: {
    list: () =>
      request<{ items: ProductNormalizationItem[] }>('/products/normalize'),
    apply: (rawNames: string[], targetNormalizedName: string) =>
      request<{ ok: boolean; updated: number }>('/products/normalize', {
        method: 'POST',
        body: JSON.stringify({ rawNames, targetNormalizedName }),
      }),
  },
  productsMerge: (sourceProductIds: string[], targetProductId: string) =>
    request<{ ok: boolean; mergedSourceIds: string[] }>('/products/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceProductIds, targetProductId }),
    }),
  getDuplicates: (threshold?: number) => {
    const q = threshold != null ? `?threshold=${encodeURIComponent(String(threshold))}` : '';
    return request<{
      pairs: Array<{ product1: Product; product2: Product; similarity: number }>;
    }>(`/products/duplicates${q}`);
  },
  autoMergeProducts: () =>
    request<{ ok: boolean; merged: number }>('/products/auto-merge', { method: 'POST' }),
  getProductHistory: (productId: string) =>
    request<{ history: ProductAuditEntry[] }>(`/products/${productId}/history`),
  priceChanges: (params?: Record<string, string>) => {
    const q = new URLSearchParams(params).toString();
    return request<{ changes: PriceChange[] }>(`/price-changes${q ? `?${q}` : ''}`);
  },
  priceHistory: (productId: string, supplierId?: string) => {
    const q = supplierId ? `?supplierId=${supplierId}` : '';
    return request<{ history: { date: string; price: number }[] }>(
      `/products/${productId}/price-history${q}`
    );
  },
  upload: (file: File, supplierName: string, sourceType: string) => {
    const form = new FormData();
    form.append('file', file);
    form.append('supplierName', supplierName);
    form.append('sourceType', sourceType);
    const token = getToken();
    return fetch(`${API}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    }).then((r) => {
      if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error)));
      return r.json();
    });
  },
  telegram: {
    status: () => request<{ enabled: boolean }>('/telegram/status'),
    users: () => request<{ users: TelegramUser[] }>('/telegram/users'),
    allow: (telegramId: string, isAllowed: boolean) =>
      request<{ ok: boolean }>(`/telegram/users/${telegramId}/allow`, {
        method: 'PATCH',
        body: JSON.stringify({ isAllowed }),
      }),
    remove: (id: string) =>
      request<{ ok: boolean }>(`/telegram/users/${id}`, { method: 'DELETE' }),
    orgSettings: () =>
      request<{
        telegram_chat_id: string | null;
        telegram_notify: TelegramNotifySettings;
      }>('/telegram/org-settings'),
    patchOrgSettings: (body: {
      telegram_chat_id?: string | null;
      telegram_notify?: TelegramNotifySettings;
    }) =>
      request<{ ok: boolean }>('/telegram/org-settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
    testMessage: () =>
      request<{ ok: boolean }>('/telegram/test', { method: 'POST', body: JSON.stringify({}) }),
  },
  iiko: {
    status: () =>
      request<{ last_sync: IikoSyncLog | null }>('/integrations/iiko/status'),
    sync: () =>
      request<{ created: number; updated: number; errors: unknown }>('/integrations/iiko/sync', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    patchSettings: (body: { iiko_api_url?: string | null; iiko_api_key?: string | null }) =>
      request<{ ok: boolean }>('/integrations/iiko/settings', {
        method: 'PATCH',
        body: JSON.stringify(body),
      }),
  },
  documents: {
    list: (status?: string) =>
      request<Document[]>(`/documents${status ? `?status=${encodeURIComponent(status)}` : ''}`),
    get: (id: string) => request<Document & { items: DocumentItem[] }>(`/documents/${id}`),
    upload: (file: File, sourceType: string) => {
      const form = new FormData();
      form.append('file', file);
      form.append('sourceType', sourceType);
      const token = getToken();
      return fetch(`${API}/documents/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }).then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(new Error(d.error || 'Upload failed')));
        return r.json();
      }) as Promise<{ message: string; documentId: string }>;
    },
    patchItem: (
      documentId: string,
      itemId: string,
      data: Partial<DocumentItem> & { save_feedback?: boolean; original_text?: string; corrected_text?: string }
    ) =>
      request<DocumentItem>(`/documents/${documentId}/items/${itemId}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    confirm: (id: string) =>
      request<{ message: string; status: string }>(`/documents/${id}/confirm`, {
        method: 'POST',
      }),
  },
};

export interface User {
  id: string;
  email: string;
  role: string;
  organization_id?: string;
}

export interface Supplier {
  id: string;
  name: string;
  created_at: string;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  telegram_chat_id?: string | null;
  notify_channel?: string | null;
  is_active?: boolean | null;
  filters_count?: number;
}

export interface Product {
  id: string;
  name: string;
  normalized_name: string;
  is_priority: boolean;
  created_at: string;
}

export interface ProductNormalizationItem {
  id: string;
  raw_name: string;
  normalized_name: string;
  usage_count: number;
  created_at: string;
}

export interface PriceChange {
  id: string;
  product_id: string;
  supplier_id: string;
  old_price: number;
  new_price: number;
  change_value: number;
  change_percent: number;
  is_priority: boolean;
  created_at: string;
  product_name: string;
  supplier_name: string;
}

export interface TelegramUser {
  id: string;
  telegram_id: string;
  username: string | null;
  role: string;
  is_allowed: boolean;
  created_at: string;
}

export interface TelegramNotifySettings {
  anomaly_high?: boolean;
  anomaly_medium?: boolean;
  recommendation?: boolean;
  order_status?: boolean;
}

export interface IikoSyncLog {
  synced_at: string | null;
  items_created: number;
  items_updated: number;
  errors: unknown;
}

export interface Document {
  id: string;
  organization_id: string;
  supplier_id: string | null;
  supplier_name: string | null;
  document_number: string | null;
  document_date: string | null;
  file_path: string;
  source_type: string;
  status: string;
  confidence: number | null;
  ocr_confidence: number | null;
  ocr_engine: string | null;
  parse_source: string | null;
  total_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProductAuditEntry {
  id: string;
  organization_id: string;
  product_id: string;
  action: string;
  actor_id: string | null;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  line_index: number;
  name: string | null;
  quantity: number;
  unit: string | null;
  price: number | null;
  sum: number | null;
  vat: number | null;
  product_id: string | null;
  needs_review: boolean;
  created_at: string;
}
