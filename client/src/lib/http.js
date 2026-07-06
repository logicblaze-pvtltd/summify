import { getGuestSessionId } from './session';

export function installFetchInterceptor() {
  if (typeof window === 'undefined' || !window.fetch) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async function wrappedFetch(url, options = {}) {
    const token = localStorage.getItem('token');
    const guestId = getGuestSessionId();

    // Don't touch FormData — browser sets Content-Type + boundary automatically
    if (options.body instanceof FormData) {
      return originalFetch(url, options);
    }

    // Merge existing headers into a plain object first so nothing is dropped
    let existingHeaders = {};
    if (options.headers instanceof Headers) {
      options.headers.forEach((value, key) => {
        existingHeaders[key] = value;
      });
    } else if (options.headers && typeof options.headers === 'object') {
      existingHeaders = { ...options.headers };
    }

    // Attach auth header on top — never overwrite Content-Type
    if (token) {
      existingHeaders['Authorization'] = `Bearer ${token}`;
    } else if (guestId) {
      existingHeaders['X-Guest-ID'] = guestId;
    }

    return originalFetch(url, {
      ...options,
      headers: existingHeaders,
    });
  };

  return () => {
    window.fetch = originalFetch;
  };
}
