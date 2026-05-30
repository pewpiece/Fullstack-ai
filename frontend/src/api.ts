import { API_URL } from './config';
import type {
  Category,
  DashboardStats,
  Inventory,
  Item,
  ItemCreate,
  ItemUpdate,
  User,
} from './types';

const TOKEN_KEY = 'inventrack_token';

type RequestOptions = RequestInit & {
  auth?: boolean;
};

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function handleUnauthorized() {
  localStorage.removeItem(TOKEN_KEY);
  window.location.replace('/login');
}

function buildUrl(path: string, params?: Record<string, string | undefined>) {
  const base = API_URL.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${base}${normalizedPath}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) {
        url.searchParams.set(key, value);
      }
    }
  }

  return url.toString();
}

async function parseResponse(response: Response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractDetail(payload: unknown) {
  if (payload && typeof payload === 'object' && 'detail' in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === 'string') {
      return detail;
    }
    if (Array.isArray(detail)) {
      const messages = detail
        .map((entry) => {
          if (entry && typeof entry === 'object' && 'msg' in entry) {
            const message = (entry as { msg?: unknown }).msg;
            if (typeof message === 'string') {
              return message;
            }
          }
          return null;
        })
        .filter((message): message is string => Boolean(message));

      if (messages.length > 0) {
        return messages.join(' ');
      }
    }
  }

  return 'Request failed';
}

async function request<T>(path: string, options: RequestOptions = {}, params?: Record<string, string | undefined>): Promise<T> {
  const { auth = true, headers, ...init } = options;
  const requestHeaders = new Headers(headers);

  if (auth) {
    const token = getToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(buildUrl(path, params), {
    ...init,
    headers: requestHeaders,
  });

  if (response.status === 401) {
    const payload = await parseResponse(response);
    handleUnauthorized();
    throw new Error(extractDetail(payload));
  }

  if (!response.ok) {
    const payload = await parseResponse(response);
    throw new Error(extractDetail(payload));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await parseResponse(response)) as T;
}

async function requestWithJson<T>(
  path: string,
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  body?: unknown,
  auth = true,
) {
  return request<T>(path, {
    method,
    auth,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function register(email: string, password: string, name?: string) {
  return request<{ access_token: string; token_type: string }>(
    '/auth/register',
    {
      method: 'POST',
      auth: false,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name: name || null }),
    },
  );
}

export async function login(email: string, password: string) {
  const form = new URLSearchParams();
  form.set('username', email);
  form.set('password', password);

  return request<{ access_token: string; token_type: string }>(
    '/auth/login',
    {
      method: 'POST',
      auth: false,
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    },
  );
}

export function getMe() {
  return request<User>('/auth/me');
}

export function getDashboardStats() {
  return request<DashboardStats>('/dashboard/stats');
}

export function getInventories() {
  return request<Inventory[]>('/inventories');
}

export function createInventory(name: string, description?: string) {
  return requestWithJson<Inventory>('/inventories', 'POST', { name, description });
}

export function updateInventory(id: string, name: string, description?: string) {
  return requestWithJson<Inventory>(`/inventories/${id}`, 'PUT', { name, description });
}

export function deleteInventory(id: string) {
  return requestWithJson<void>(`/inventories/${id}`, 'DELETE');
}

export function getInventory(id: string) {
  return request<Inventory>(`/inventories/${id}`);
}

export function getCategories(invId: string) {
  return request<Category[]>(`/inventories/${invId}/categories`);
}

export function createCategory(invId: string, name: string, description?: string) {
  return requestWithJson<Category>(`/inventories/${invId}/categories`, 'POST', {
    name,
    description,
  });
}

export function updateCategory(invId: string, catId: string, name: string, description?: string) {
  return requestWithJson<Category>(`/inventories/${invId}/categories/${catId}`, 'PUT', {
    name,
    description,
  });
}

export function deleteCategory(invId: string, catId: string) {
  return requestWithJson<void>(`/inventories/${invId}/categories/${catId}`, 'DELETE');
}

export function getItems(params?: { cat_id?: string; inv_id?: string }) {
  return request<Item[]>('/items', {}, params);
}

export function createItem(data: ItemCreate) {
  return requestWithJson<Item>('/items', 'POST', data);
}

export function updateItem(id: string, data: ItemUpdate) {
  return requestWithJson<Item>(`/items/${id}`, 'PUT', data);
}

export function deleteItem(id: string) {
  return requestWithJson<void>(`/items/${id}`, 'DELETE');
}