import type {
  AdminOverviewDTO,
  CheckoutPaymentInput,
  DriverApplicationDTO,
  DriverApplicationStatus,
  DriverOnboardingPayload,
  OrderDTO,
  OrderMessageDTO,
  StoreDTO,
  UserProfile,
  UserRole,
} from '../types.ts';

const AUTH_TOKEN_STORAGE_KEY = 'hazyeats_auth_token';

function readStoredToken(): string | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors
  }
  return null;
}

let memoryAuthToken: string | null = readStoredToken();

export function setMemoryAuthToken(token: string | null): void {
  memoryAuthToken = token;
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      if (token) {
        window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
      } else {
        window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
      }
    }
  } catch {
    // Ignore storage access errors
  }
}

export function getMemoryAuthToken(): string | null {
  return memoryAuthToken;
}

async function apiFetch<T>(
  url: string,
  options: RequestInit = {},
  tokenOverride?: string | null
): Promise<T> {
  const token = tokenOverride ?? memoryAuthToken;
  const headers = new Headers(options.headers);
  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  let data: Record<string, unknown> = {};
  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      data = {};
    }
  }

  if (!res.ok) {
    const errMsg =
      typeof data.error === 'string'
        ? data.error
        : `Request failed with status ${res.status}`;
    throw new Error(errMsg);
  }

  return data as T;
}

export async function fetchStores(): Promise<StoreDTO[]> {
  const data = await apiFetch<{ stores: StoreDTO[] }>('/api/stores', {
    cache: 'no-cache',
  });
  return data.stores;
}

export async function loginWithEmail(
  email: string,
  password: string
): Promise<{ user: UserProfile; token: string }> {
  const data = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setMemoryAuthToken(data.token);
  return data;
}

export async function registerWithEmail(payload: {
  email: string;
  password: string;
  name: string;
  phone: string;
  role: UserRole;
  vehicle: string;
  storeName: string;
  adminCode?: string;
}): Promise<{ user: UserProfile; token: string }> {
  const data = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  setMemoryAuthToken(data.token);
  return data;
}

export async function syncGoogleSession(
  idToken: string,
  extras?: { role?: UserRole; phone?: string; vehicle?: string; storeName?: string }
): Promise<{ user: UserProfile }> {
  setMemoryAuthToken(idToken);
  return apiFetch<{ user: UserProfile }>(
    '/api/auth/google',
    {
      method: 'POST',
      body: JSON.stringify(extras ?? {}),
    },
    idToken
  );
}

export async function fetchCurrentUser(): Promise<UserProfile> {
  const data = await apiFetch<{ user: UserProfile }>('/api/auth/me');
  return data.user;
}

export async function fetchOrders(): Promise<OrderDTO[]> {
  const data = await apiFetch<{ orders: OrderDTO[] }>('/api/orders');
  return data.orders;
}

export async function placeOrder(payload: {
  address: string;
  items: Array<{ itemId: string; qty: number }>;
  payment: CheckoutPaymentInput;
}): Promise<OrderDTO> {
  const data = await apiFetch<{ order: OrderDTO }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.order;
}

export async function updateStorePrepStatus(
  orderId: string,
  status: 'Preparing' | 'Ready',
  storeName?: string
): Promise<OrderDTO> {
  const data = await apiFetch<{ order: OrderDTO }>(
    `/api/orders/${encodeURIComponent(orderId)}/store-status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ storeName, status }),
    }
  );
  return data.order;
}

export async function markStoreReady(
  orderId: string,
  storeName?: string
): Promise<OrderDTO> {
  return updateStorePrepStatus(orderId, 'Ready', storeName);
}

export async function acceptDelivery(orderId: string): Promise<OrderDTO> {
  const data = await apiFetch<{ order: OrderDTO }>(
    `/api/orders/${encodeURIComponent(orderId)}/accept-delivery`,
    { method: 'PATCH' }
  );
  return data.order;
}

export async function completeDelivery(orderId: string): Promise<OrderDTO> {
  const data = await apiFetch<{ order: OrderDTO }>(
    `/api/orders/${encodeURIComponent(orderId)}/complete-delivery`,
    { method: 'PATCH' }
  );
  return data.order;
}

export async function onboardVendorStore(payload: {
  name: string;
  category: string;
  dishName: string;
  priceZar: number;
}): Promise<StoreDTO> {
  const data = await apiFetch<{ store: StoreDTO }>('/api/stores', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.store;
}

export async function addStoreMenuItem(
  storeName: string,
  payload: { name: string; priceZar: number }
) {
  return apiFetch<{ item: StoreDTO['menu'][number] }>(
    `/api/stores/${encodeURIComponent(storeName)}/menu`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}

export async function fetchAdminOverview(): Promise<AdminOverviewDTO> {
  const data = await apiFetch<{ overview: AdminOverviewDTO }>('/api/admin/overview');
  return data.overview;
}

export async function submitDriverApplication(
  payload: DriverOnboardingPayload
): Promise<DriverApplicationDTO> {
  const data = await apiFetch<{ application: DriverApplicationDTO }>(
    '/api/driver-applications',
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
  return data.application;
}

export async function fetchDriverApplications(): Promise<DriverApplicationDTO[]> {
  const data = await apiFetch<{ applications: DriverApplicationDTO[] }>(
    '/api/driver-applications'
  );
  return data.applications;
}

export async function updateDriverApplicationStatus(
  applicationId: string,
  status: DriverApplicationStatus
): Promise<DriverApplicationDTO> {
  const data = await apiFetch<{ application: DriverApplicationDTO }>(
    `/api/driver-applications/${encodeURIComponent(applicationId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }
  );
  return data.application;
}

export async function fetchOrderMessages(orderId: string): Promise<OrderMessageDTO[]> {
  const data = await apiFetch<{ messages: OrderMessageDTO[] }>(
    `/api/orders/${encodeURIComponent(orderId)}/messages`
  );
  return data.messages;
}

export async function sendOrderMessage(
  orderId: string,
  body: string
): Promise<OrderMessageDTO> {
  const data = await apiFetch<{ message: OrderMessageDTO }>(
    `/api/orders/${encodeURIComponent(orderId)}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ body }),
    }
  );
  return data.message;
}

export function subscribeOrderStream(
  onUpdate: () => void,
  onOrderMessage?: (payload: { orderId: string; message: OrderMessageDTO }) => void
): () => void {
  const token = getMemoryAuthToken();
  if (!token) return () => {};

  let stopped = false;
  let controller = new AbortController();
  let reconnectTimer: number | null = null;
  let hasConnectedOnce = false;

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== null) return;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null;
      if (!stopped) {
        void connect();
      }
    }, 2500);
  };

  const connect = async () => {
    if (stopped) return;
    controller = new AbortController();
    try {
      const response = await fetch('/api/orders/stream', {
        headers: { Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        scheduleReconnect();
        return;
      }

      if (hasConnectedOnce) {
        onUpdate();
      }
      hasConnectedOnce = true;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true }).replace(/\r\n/g, '\n');

        let sepIdx = buffer.indexOf('\n\n');
        while (sepIdx !== -1) {
          const rawEvent = buffer.slice(0, sepIdx);
          buffer = buffer.slice(sepIdx + 2);
          if (rawEvent.includes('event: order_updated')) {
            onUpdate();
          } else if (rawEvent.includes('event: order_message') && onOrderMessage) {
            const dataLine = rawEvent
              .split('\n')
              .find((line) => line.startsWith('data: '));
            if (dataLine) {
              try {
                const parsed = JSON.parse(dataLine.slice(6)) as {
                  orderId: string;
                  message: OrderMessageDTO;
                };
                if (parsed?.orderId && parsed?.message) {
                  onOrderMessage(parsed);
                }
              } catch {
                // Ignore malformed SSE payload
              }
            }
          }
          sepIdx = buffer.indexOf('\n\n');
        }

        if (buffer.length > 8192) {
          buffer = buffer.slice(-1024);
        }
      }

      if (!stopped) {
        scheduleReconnect();
      }
    } catch {
      if (!stopped) {
        scheduleReconnect();
      }
    }
  };

  void connect();

  return () => {
    stopped = true;
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    controller.abort();
  };
}
