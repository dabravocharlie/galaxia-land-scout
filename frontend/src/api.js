// src/api.js
// Thin wrapper around fetch for talking to the backend API.
// Set VITE_API_URL in a .env file when deploying (points at the Render backend).

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getListings: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return request(`/api/listings${qs ? `?${qs}` : ''}`);
  },
  getListing: (id) => request(`/api/listings/${id}`),
  updateListing: (id, updates) =>
    request(`/api/listings/${id}`, { method: 'PATCH', body: JSON.stringify(updates) }),
  getStats: () => request('/api/listings/stats/summary'),
  getSourceStatus: () => request('/api/sources/status'),
  getCounties: () => request('/api/counties'),
  getCountyAlerts: () => request('/api/counties/alerts'),
  markCountyReviewed: (id) =>
    request(`/api/counties/${id}/reviewed`, { method: 'PATCH' }),
  getTechStocks: (params = {}) => {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))
    ).toString();
    return request(`/api/techstocks${qs ? `?${qs}` : ''}`);
  },
  getTechStats: () => request('/api/techstocks/stats/summary'),
  updateTechStock: (id, updates) =>
    request(`/api/techstocks/${id}`, { method: 'PATCH', body: JSON.stringify(updates) })
};
