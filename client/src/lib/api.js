const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function apiUrl(path) {
  if (!path) return API_BASE;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}
