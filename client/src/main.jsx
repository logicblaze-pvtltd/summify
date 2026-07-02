import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { FeedbackProvider } from './components/FeedbackProvider'
import './index.css'
import App from './App.jsx'

// Generate guest session ID if not present
let guestSessionId = localStorage.getItem('guestSessionId');
if (!guestSessionId) {
  guestSessionId = 'guest_' + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  localStorage.setItem('guestSessionId', guestSessionId);
}

// Global Fetch Interceptor to attach JWT token or guest ID to all API calls automatically
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { ...options.headers };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  } else {
    const guestId = localStorage.getItem('guestSessionId');
    if (guestId) {
      headers['X-Guest-ID'] = guestId;
    }
  }
  
  options.headers = headers;
  return originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FeedbackProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </FeedbackProvider>
  </StrictMode>,
)
