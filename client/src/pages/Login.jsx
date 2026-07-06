import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFeedback } from '../components/FeedbackProvider';
import { useGoogleLogin } from '@react-oauth/google';
import { apiFetch } from '../lib/api';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleLoadingRef = useRef(false);
  const googleTimeoutRef = useRef(null);
  const googleFocusListenerRef = useRef(null);
  const navigate = useNavigate();
  const { showToast } = useFeedback();

  const setGoogleLoadingState = (value) => {
    googleLoadingRef.current = value;
    setGoogleLoading(value);
  };

  const clearGoogleTimeout = () => {
    if (googleTimeoutRef.current) {
      window.clearTimeout(googleTimeoutRef.current);
      googleTimeoutRef.current = null;
    }
    if (googleFocusListenerRef.current) {
      window.removeEventListener('focus', googleFocusListenerRef.current);
      googleFocusListenerRef.current = null;
    }
  };

  const handleGooglePopupReturn = () => {
    if (googleLoadingRef.current) {
      clearGoogleTimeout();
      setGoogleLoadingState(false);
      showToast({ title: 'Google Sign-In cancelled', message: 'Popup closed without signing in.', tone: 'warning' });
    }
  };

  useEffect(() => {
    return () => clearGoogleTimeout();
  }, []);

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      try {
        showToast({ title: 'Connecting', message: 'Verifying with Summify...', tone: 'info' });
        const res = await apiFetch('/api/auth/google', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-guest-id': localStorage.getItem('guestId') || 'guest_default'
          },
          body: JSON.stringify({ token: tokenResponse.access_token }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Google Authentication failed');

        onLoginSuccess(data.token, data.user);
        showToast({ title: 'Welcome', message: 'Logged in successfully via Google!', tone: 'success' });
        navigate('/');
      } catch (err) {
        showToast({ title: 'Auth Failed', message: err.message, tone: 'danger' });
      } finally {
        clearGoogleTimeout();
        setGoogleLoadingState(false);
      }
    },
    onError: () => {
      clearGoogleTimeout();
      setGoogleLoadingState(false);
      showToast({ title: 'Error', message: 'Google Sign-In was cancelled.', tone: 'warning' });
    },
    onNonOAuthError: (error) => {
      clearGoogleTimeout();
      setGoogleLoadingState(false);
      showToast({ title: 'Google Sign-In failed', message: error?.error || 'Please try again.', tone: 'danger' });
    }
  });

  const handleGoogleButtonClick = () => {
    if (googleLoadingRef.current) return;
    setGoogleLoadingState(true);
    googleLogin();
    googleFocusListenerRef.current = handleGooglePopupReturn;
    window.addEventListener('focus', googleFocusListenerRef.current);
    googleTimeoutRef.current = window.setTimeout(() => {
      if (googleLoadingRef.current) {
        handleGooglePopupReturn();
      }
    }, 15000);
  };

  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const section = e.currentTarget;
    const centerX = section.offsetWidth / 2;
    const centerY = section.offsetHeight / 2;
    const moveX = (e.clientX - centerX) / 50;
    const moveY = (e.clientY - centerY) / 50;
    setTranslate({ x: moveX, y: moveY });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showToast({
        title: 'Missing details',
        message: 'Please fill in both email and password.',
        tone: 'warning'
      });
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login failed');
      }

      onLoginSuccess(data.token, data.user);
      const migratedCount = data.guestDocumentsMigrated || 0;
      showToast({
        title: 'Welcome back',
        message: migratedCount > 0
          ? `${migratedCount} guest PDF${migratedCount !== 1 ? 's' : ''} moved to your account.`
          : 'You have logged in successfully.',
        tone: 'success'
      });
      navigate('/');
    } catch (err) {
      showToast({
        title: 'Login failed',
        message: err.message || 'Unable to sign in right now.',
        tone: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-full overflow-hidden bg-zinc-50 dark:bg-black text-neutral-900 dark:text-white transition-colors duration-300">

      {/* VISUAL SIDE (LEFT) */}
      <section
        className="hidden md:flex flex-1 relative bg-[#f0f9f6] dark:bg-[#09110e] border-r border-neutral-200 dark:border-neutral-900 overflow-hidden select-none transition-colors duration-300"
        onMouseMove={handleMouseMove}
      >
        {/* Glow Effects */}
        <div className="absolute inset-0 opacity-40 dark:opacity-20 transition-opacity">
          <div className="absolute -top-[20%] -left-[10%] w-[80%] h-[80%] bg-[#48a687]/20 dark:bg-[#48a687]/30 blur-[120px] rounded-full"></div>
          <div className="absolute -bottom-[10%] -right-[10%] w-[60%] h-[60%] bg-[#73D9B7]/20 dark:bg-[#73D9B7]/10 blur-[100px] rounded-full"></div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center p-12 lg:p-24 text-center">
          <div
            className="w-full max-w-2xl transition-transform duration-75 ease-out"
            style={{ transform: `translate(${translate.x}px, ${translate.y}px)` }}
          >
            <img
              className="w-full h-auto drop-shadow-2xl rounded-xl border border-neutral-200/50 dark:border-neutral-800/50"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDVfOcneyP_eZfE7BkbYG_hmtWbXww99XlcQ6g1YRI8JGWhY5CMOIeHDY9cHvW2VYg8gD8Wq3_HlaZMjfHDw2D8u8mkr6XOkFgV4ZOKaCmXNsqOxAkphsA2mYzqYVb2CLljCex88vEmDBdymiNPvk1jQ1Hp3VSA6Ifw8XTdLWpCKuV4eQzlMLkBKDR2B9RyJG3pAAT87hYQhqlNVIjq9W595uz-RpcW9ekhKpEJ53frcAqBTb4xP8s"
              alt="Visual Presentation"
            />
          </div>
          <div className="mt-12 space-y-4 max-w-lg">
            <div className="flex flex-wrap justify-center gap-3">
              <div className="px-4 py-1.5 bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-full flex items-center gap-2 text-xs font-medium shadow-sm glassmorphism">
                <span className="material-symbols-outlined text-sm text-[#067357] dark:text-[#73D9B7]">shield</span>
                <span>Privacy Guaranteed</span>
              </div>
              <div className="px-4 py-1.5 bg-white/80 dark:bg-neutral-900/80 border border-neutral-200 dark:border-neutral-800 text-neutral-600 dark:text-neutral-300 rounded-full flex items-center gap-2 text-xs font-medium shadow-sm glassmorphism">
                <span className="material-symbols-outlined text-sm text-[#067357] dark:text-[#73D9B7]">auto_awesome</span>
                <span>AI Insights</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">Designed for Deep Work</h3>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm leading-relaxed(none)">
              Summify is a web-based AI summarizer that transforms lengthy documents into clear, concise insights in seconds.
            </p>
          </div>
        </div>

        {/* Tech Grid Background SVG */}
        <svg className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-[0.04] dark:opacity-[0.02]" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"></path>
            </pattern>
          </defs>
          <rect fill="url(#grid)" height="100%" width="100%"></rect>
        </svg>
      </section>

      {/* LOGIN FORM SIDE (RIGHT) */}
      <section className="flex-1 flex flex-col justify-between px-6 py-8 md:px-16 lg:px-24 bg-white dark:bg-[#0c0d0e] z-10 overflow-y-auto transition-colors duration-300">
        
        {/* Top: Brand Anchor Header */}
        <div className="flex items-center gap-3 w-full pb-6">
          <svg className="h-20 w-auto opacity-95" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 250">
            <defs>
              <linearGradient id="sumifyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#47AF8F" />
                <stop offset="100%" stopColor="#067357" />
              </linearGradient>
              <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="3" dy="8" stdDeviation="6" floodColor="#73D9B7" floodOpacity="0.12" />
              </filter>
            </defs>
            <g transform="translate(50, 45)" filter="url(#softShadow)">
              <rect x="10" y="10" width="100" height="140" rx="14" fill="#067357" opacity="0.2" />
              <rect x="26" y="25" width="100" height="120" rx="12" fill="url(#sumifyGradient)" opacity="0.4" />
              <rect x="42" y="40" width="100" height="100" rx="10" fill="#73D9B7" />
              <line x1="62" y1="68" x2="112" y2="68" stroke="#F5F6FB" strokeWidth="5.5" strokeLinecap="round" opacity="0.9" />
              <line x1="62" y1="85" x2="102" y2="85" stroke="#F5F6FB" strokeWidth="5.5" strokeLinecap="round" opacity="0.9" />
              <line x1="62" y1="102" x2="87" y2="102" stroke="url(#sumifyGradient)" strokeWidth="6.5" strokeLinecap="round" />
            </g>
            <text x="215" y="152" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="120" fontWeight="800" fill="#47AF8F" className="dark:fill-[#73D9B7]" letterSpacing="-2.5">
              Summ<tspan fill="url(#sumifyGradient)">ify</tspan>
            </text>
            <text x="220" y="192" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="24" fontWeight="700" fill="#067357" letterSpacing="5" opacity="0.8">
              PDF SUMMARIZER
            </text>
          </svg>
        </div>

        {/* Center: Content & Form Wrapper */}
        <div className="w-full max-w-md mx-auto my-auto space-y-6">
          <div className="space-y-2 text-left">
            <h2 className="text-3xl font-extrabold text-neutral-800 dark:text-neutral-100 tracking-tight">Secure Login</h2>
            <p className="text-neutral-500 dark:text-neutral-400 text-sm">Process, analyze, and summarize your PDFs with AI.</p>
          </div>

          {/* Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-1.5 text-left">
              <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400" htmlFor="email">EMAIL ADDRESS</label>
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 dark:text-neutral-500">mail</span>
                <input
                  className="w-full pl-10 pr-4 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[10px] text-neutral-900 dark:text-white focus:outline-none custom-focus transition-all placeholder-neutral-400 dark:placeholder-neutral-600"
                  id="email"
                  placeholder="name@company.com"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400" htmlFor="password">PASSWORD</label>
                <a className="text-xs font-semibold uppercase tracking-wider text-[#067357] dark:text-[#73D9B7] hover:underline" href="#forgot">FORGOT?</a>
              </div>
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-400 dark:text-neutral-500">lock</span>
                <input
                  className="w-full pl-10 pr-12 py-3 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[10px] text-neutral-900 dark:text-white focus:outline-none custom-focus transition-all placeholder-neutral-400 dark:placeholder-neutral-600"
                  id="password"
                  placeholder="••••••••"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 hover:text-neutral-900 dark:hover:text-white transition-colors"
                  onClick={() => setShowPassword(!showPassword)}
                  type="button"
                >
                  <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                </button>
              </div>
            </div>

            <button
              className="w-full py-3 bg-[#73D9B7] hover:bg-[#48a687] text-neutral-950 rounded-[10px] font-semibold transition-all shadow-md active:scale-[0.98] disabled:opacity-70 mt-6 flex items-center justify-center gap-2"
              type="submit"
              disabled={loading}
            >
              <span>{loading ? "Logging in..." : "Login to Summify"}</span>
              {!loading && <span className="material-symbols-outlined text-[20px]">arrow_forward</span>}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800"></div>
            <span className="px-3 text-xs text-neutral-400 dark:text-neutral-500 uppercase font-medium">or</span>
            <div className="flex-1 border-t border-neutral-200 dark:border-neutral-800"></div>
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleButtonClick}
            disabled={loading || googleLoading}
            className="w-full py-3 px-4 bg-neutral-50 dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-[10px] text-neutral-700 dark:text-neutral-200 font-medium shadow-sm flex items-center justify-center gap-3 hover:bg-neutral-100 dark:hover:bg-neutral-800 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <>
                <span className="w-5 h-5 rounded-full border-2 border-neutral-400 dark:border-white/30 border-t-neutral-900 dark:border-t-white animate-spin" />
                <span>Please wait...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
                </svg>
                Continue with Google
              </>
            )}
          </button>

          {/* Footer Link */}
          <p className="text-center text-sm text-neutral-500 dark:text-neutral-400">
            Don't have an account?{' '}
            <Link className="text-[#067357] dark:text-[#73D9B7] font-semibold hover:underline" to="/register">Start for free</Link>
          </p>
        </div>

        {/* Bottom: Security Badge */}
        <div className="flex items-center justify-center gap-2 pt-4 w-full">
          <span className="material-symbols-outlined text-[#48a687] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
          <span className="text-xs uppercase tracking-wider text-neutral-400 dark:text-neutral-500 font-semibold">End-to-End Encrypted & AI processing</span>
        </div>
      </section>

      {/* Mobile Floating Interaction */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-max px-6 py-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-full shadow-lg z-50 flex items-center gap-4 transition-colors duration-300">
        <span className="text-xs font-bold tracking-wider text-neutral-500 dark:text-neutral-400">SECURE CLOUD</span>
        <div className="w-1.5 h-1.5 rounded-full bg-[#067357] dark:bg-[#73D9B7] animate-pulse-primary"></div>
        <span className="text-xs font-bold tracking-wider text-neutral-500 dark:text-neutral-400">LOCAL AI</span>
      </div>

      <style>{`
        @keyframes pulse-primary {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        .animate-pulse-primary {
          animation: pulse-primary 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        .custom-focus:focus {
          border-color: #48a687 !important;
          box-shadow: 0 0 0 3px rgba(72, 166, 135, 0.15) !important;
        }
        .dark .custom-focus:focus {
          border-color: #73D9B7 !important;
          box-shadow: 0 0 0 3px rgba(115, 217, 183, 0.15) !important;
        }
        .glassmorphism {
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
        }
      `}</style>
    </main>
  );
}
