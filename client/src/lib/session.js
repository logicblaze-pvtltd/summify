const GUEST_SESSION_KEY = 'guestSessionId';

export function ensureGuestSessionId() {
  let guestSessionId = localStorage.getItem(GUEST_SESSION_KEY);
  if (!guestSessionId) {
    guestSessionId =
      'guest_' +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    localStorage.setItem(GUEST_SESSION_KEY, guestSessionId);
  }
  return guestSessionId;
}

export function getGuestSessionId() {
  return localStorage.getItem(GUEST_SESSION_KEY);
}
