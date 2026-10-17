import {
  CurrentActor, EventItem, GroceryItem, Expense, BalancesData,
  Settlement, PublicInviteInfo
} from '../types';

const API_BASE = '';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include'
  });

  if (!res.ok) {
    let errorMsg = `Erreur HTTP ${res.status}`;
    try {
      const errData = await res.json();
      errorMsg = errData.detail || errData.message || errorMsg;
    } catch (e) {}
    throw new Error(errorMsg);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Auth
  getMe: () => request<CurrentActor>('/api/auth/me'),
  logout: () => fetch('/auth/logout', { credentials: 'include' }),
  exchangeAuthCode: (code: string, state?: string) =>
    request<any>(`/auth/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`),

  // Events
  getEvents: () => request<EventItem[]>('/api/events'),
  listEvents: () => request<EventItem[]>('/api/events'),
  getEvent: (id: string) => request<EventItem>(`/api/events/${id}`),
  createEvent: (data: any) => request<EventItem>('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  updateEvent: (id: string, data: any) => request<EventItem>(`/api/events/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteEvent: (id: string) => request<void>(`/api/events/${id}`, { method: 'DELETE' }),

  // Invites
  createInvite: (eventId: string, data: any) => request<any>(`/api/events/${eventId}/invites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  revokeInvite: (eventId: string, inviteId: string) => request<void>(`/api/events/${eventId}/invites/${inviteId}`, {
    method: 'DELETE'
  }),
  getPublicInvite: (token: string) => request<PublicInviteInfo>(`/api/invites/${token}/info`),
  joinInvite: (token: string, guestName?: string) => request<any>(`/api/invites/${token}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guest_name: guestName })
  }),

  // Groceries
  getGroceries: (eventId: string) => request<GroceryItem[]>(`/api/events/${eventId}/groceries`),
  addGrocery: (eventId: string, data: any) => request<GroceryItem>(`/api/events/${eventId}/groceries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  updateGrocery: (eventId: string, itemId: string, data: any) => request<GroceryItem>(`/api/events/${eventId}/groceries/${itemId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteGrocery: (eventId: string, itemId: string) => request<void>(`/api/events/${eventId}/groceries/${itemId}`, {
    method: 'DELETE'
  }),
  convertGroceriesToExpense: (eventId: string, title?: string, totalAmount?: number) =>
    request<any>(`/api/events/${eventId}/groceries/to-expense`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, total_amount: totalAmount })
    }),

  // Expenses & Balances
  getExpenses: (eventId: string) => request<Expense[]>(`/api/events/${eventId}/expenses`),
  createExpense: (eventId: string, data: any) => request<Expense>(`/api/events/${eventId}/expenses`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  deleteExpense: (eventId: string, expenseId: string) => request<void>(`/api/events/${eventId}/expenses/${expenseId}`, {
    method: 'DELETE'
  }),
  getBalances: (eventId: string) => request<BalancesData>(`/api/events/${eventId}/balances`),
  recordSettlement: (eventId: string, data: any) => request<Settlement>(`/api/events/${eventId}/settlements`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  }),
  getSettlements: (eventId: string) => request<Settlement[]>(`/api/events/${eventId}/settlements`),

  // Uploads
  uploadReceipt: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return request<{ url: string; drive_id?: string; is_drive: boolean }>('/api/uploads', {
      method: 'POST',
      body: formData
    });
  },

  // AI Assistant
  askAI: (prompt: string, eventId?: string, contextType: string = 'general') =>
    request<{ content: string; suggested_groceries?: any[] }>('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, event_id: eventId, context_type: contextType })
    })
};
