import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { FeedbackProvider } from './components/FeedbackProvider'
import { GoogleOAuthProvider } from '@react-oauth/google';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/inter/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/material-symbols-outlined';
import './tailwind.css'
import App from './App.jsx'
import { ensureGuestSessionId } from './lib/session';
import { installFetchInterceptor } from './lib/http';

ensureGuestSessionId();
installFetchInterceptor();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleOAuthProvider clientId="154097788381-p636nmaq55f0bguhn4tt182rk4rouebd.apps.googleusercontent.com">
      <FeedbackProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </FeedbackProvider>
    </GoogleOAuthProvider>
  </StrictMode>,
)
