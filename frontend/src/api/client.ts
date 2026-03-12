const API = '/api';

function getToken(): string | null {
  return localStorage.getItem('accessToken');
}

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
    register: (email: string, password: string, role?: string) =>
      request<{ user: User; accessToken: string; refreshToken: string }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ email, password, role: role || 'viewer' }),
      }),
    logout: (refreshToken?: string) =>
      request<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }),
    me: () => request<{ user: User }>('/auth/me'),
  },
  suppliers: () => request<{ suppliers: Supplier[] }>('/suppliers'),
  products: () => request<{ products: Product[] }>('/products'),
  setPriority: (id: string, isPriority: boolean) =>
    request<{ ok: boolean }>(`/products/${id}/priority`, {
      method: 'PATCH',
      body: JSON.stringify({ isPriority }),
    }),
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
  },
};

export interface User {
  id: string;
  email: string;
  role: string;
}

export interface Supplier {
  id: string;
  name: string;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  normalized_name: string;
  is_priority: boolean;
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
