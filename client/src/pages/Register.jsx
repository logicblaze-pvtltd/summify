import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useFeedback } from '../components/FeedbackProvider';

export default function Register({ onLoginSuccess }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { showToast } = useFeedback();

  // Parallax translation offset for the visual image
  const [translate, setTranslate] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e) => {
    const section = e.currentTarget;
    const centerX = section.offsetWidth / 2;
    const centerY = section.offsetHeight / 2;
    const moveX = (e.clientX - centerX) / 50;
    const moveY = (e.clientY - centerY) / 50;
    setTranslate({ x: moveX, y: moveY });
  };

  const handleGoogleLogin = () => {
    showToast({
      title: 'Connecting',
      message: 'Opening Google Sign-In...',
      tone: 'info'
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password || !confirmPassword) {
      showToast({
        title: 'Missing details',
        message: 'Please fill in all fields.',
        tone: 'warning'
      });
      return;
    }

    if (password !== confirmPassword) {
      showToast({
        title: 'Password Mismatch',
        message: 'Passwords do not match.',
        tone: 'warning'
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      onLoginSuccess(data.token, data.user);
      const migratedCount = data.guestDocumentsMigrated || 0;
      showToast({
        title: 'Account created',
        message: migratedCount > 0
          ? `${migratedCount} guest PDF${migratedCount !== 1 ? 's' : ''} moved to your account.`
          : 'Your account is ready. Welcome aboard!',
        tone: 'success'
      });
      navigate('/');
    } catch (err) {
      showToast({
        title: 'Registration failed',
        message: err.message || 'Unable to create the account right now.',
        tone: 'danger'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex h-screen w-full overflow-hidden bg-black text-white">
      {/* Registration Side (Left) */}
      <section className="flex-1 flex flex-col justify-between px-6 py-8 md:px-16 lg:px-24 bg-[#0c0d0e] z-10 overflow-y-auto">

        {/* Top: Brand Anchor Header (Ensured Visibility) */}
        <div className="flex items-center gap-3 w-full pb-6">
          <svg
            className="h-20 w-auto opacity-95"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 800 250"
          >
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
            <text x="215" y="152" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="120" fontWeight="800" fill="#73D9B7" letterSpacing="-2.5">
              Sum<tspan fill="url(#sumifyGradient)">ify</tspan>
            </text>
            <text x="220" y="192" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="24" fontWeight="700" fill="#067357" letterSpacing="5" opacity="0.8">
              PDF SUMMARIZER
            </text>
          </svg>
        </div>

        {/* Center: Content & Form Wrapper */}
        <div className="w-full max-w-xl mx-auto my-auto space-y-6">
          <div className="space-y-2 text-left">
            <h2 className="text-3xl font-extrabold text-neutral-100 tracking-tight">Join the Community</h2>
            <p className="text-neutral-400 text-sm">Your professional, secure, and AI-powered workspace awaits.</p>
          </div>

          {/* Registration Form */}
          <form className="space-y-4" onSubmit={handleSubmit}>
            
            {/* Row 1: Name & Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400" htmlFor="name">Full Name</label>
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-500">person</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-[10px] text-white focus:outline-none custom-focus transition-all placeholder-neutral-600"
                    id="name"
                    placeholder="Alex Rivera"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400" htmlFor="email">Email Address</label>
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-500">mail</span>
                  <input
                    className="w-full pl-10 pr-4 py-3 bg-neutral-900 border border-neutral-800 rounded-[10px] text-white focus:outline-none custom-focus transition-all placeholder-neutral-600"
                    id="email"
                    placeholder="alex@lumina.ai"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Row 2: Password & Confirm Password */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400" htmlFor="password">Password</label>
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-500">lock</span>
                  <input
                    className="w-full pl-10 pr-12 py-3 bg-neutral-900 border border-neutral-800 rounded-[10px] text-white focus:outline-none custom-focus transition-all placeholder-neutral-600"
                    id="password"
                    placeholder="••••••••"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 text-left">
                <label className="text-xs font-semibold uppercase tracking-wider text-neutral-400" htmlFor="confirmPassword">Confirm Password</label>
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 material-symbols-outlined text-neutral-500">lock_reset</span>
                  <input
                    className="w-full pl-10 pr-12 py-3 bg-neutral-900 border border-neutral-800 rounded-[10px] text-white focus:outline-none custom-focus transition-all placeholder-neutral-600"
                    id="confirmPassword"
                    placeholder="••••••••"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  <button
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white"
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <span className="material-symbols-outlined">{showConfirmPassword ? "visibility_off" : "visibility"}</span>
                  </button>
                </div>
              </div>
            </div>

            <button
              className="w-full py-3 bg-[#73D9B7] hover:bg-[#48a687] text-neutral-950 rounded-[10px] font-semibold transition-all shadow-md active:scale-[0.98] disabled:opacity-70 mt-4"
              type="submit"
              disabled={loading}
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center my-4">
            <div className="flex-1 border-t border-neutral-800"></div>
            <span className="px-3 text-xs text-neutral-500 uppercase font-medium">or</span>
            <div className="flex-1 border-t border-neutral-800"></div>
          </div>

          {/* Continue with Google Button */}
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full py-3 px-4 bg-neutral-900 border border-neutral-800 rounded-[10px] text-neutral-200 font-medium shadow-sm flex items-center justify-center gap-3 hover:bg-neutral-800 active:scale-[0.98] transition-all"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
            </svg>
            Continue with Google
          </button>

          <p className="text-center text-sm text-neutral-400">
            Already have an account?{' '}
            <Link className="text-[#73D9B7] font-semibold hover:underline" to="/login">Sign in</Link>
          </p>
        </div>

        {/* Bottom: Local-First Badge */}
        <div className="flex items-center justify-center gap-2 pt-4 w-full">
          <span className="material-symbols-outlined text-[#48a687] text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
          <span className="text-xs uppercase tracking-wider text-neutral-500 font-semibold">SUMMARIZE PDF USER AI</span>
        </div>
      </section>

      {/* Visual Side (Right) */}
      <section
        className="hidden md:flex flex-1 relative bg-[#09110e] border-l border-neutral-900 overflow-hidden select-none"
        onMouseMove={handleMouseMove}
      >
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -top-[20%] -right-[10%] w-[80%] h-[80%] bg-[#48a687]/30 blur-[120px] rounded-full"></div>
          <div className="absolute -bottom-[10%] -left-[10%] w-[60%] h-[60%] bg-[#73D9B7]/10 blur-[100px] rounded-full"></div>
        </div>

        <div className="relative z-10 w-full flex flex-col items-center justify-center p-12 lg:p-24 text-center">
          <div
            className="w-full max-w-2xl transition-transform duration-75 ease-out"
            style={{ transform: `translate(${translate.x}px, ${translate.y}px)` }}
          >
            <img
              className="w-full h-auto drop-shadow-2xl rounded-xl"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuA_0vKbuhy35xtTHue3O0Ug2SgZ_GwE1oCorlh05xf61l6lbmP5FCSOiZgRD18WzqMqTLpIn1637MorYkUMUW-NkOL1lz2t6P4hw0fK9G-5F6oxrSsqh41fmYrjS5D7NiLdGrHu1Tt6_wuh_t_GnoT_l8XqP8iMtwHBNXjniFf0RZ7ykLhrAf4ZAkid_JPa1yD9h39toyPo1dK7WIJHFTRUnhckNs3MrU_Pnfxmz7Z-iAusf9rUfRw"
              alt="Visual Presentation"
            />
          </div>
          <div className="mt-12 space-y-4 max-w-lg">
            <div className="flex flex-wrap justify-center gap-3">
              <div className="px-4 py-1.5 bg-neutral-900/80 border border-neutral-800 text-neutral-300 rounded-full flex items-center gap-2 text-xs font-medium">
                <span className="material-symbols-outlined text-sm text-[#73D9B7]">shield</span>
                <span>Privacy Guaranteed</span>
              </div>
              <div className="px-4 py-1.5 bg-neutral-900/80 border border-neutral-800 text-neutral-300 rounded-full flex items-center gap-2 text-xs font-medium">
                <span className="material-symbols-outlined text-sm text-[#73D9B7]">auto_awesome</span>
                <span>AI Insights</span>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-neutral-100">Designed for Deep Work</h3>
            <p className="text-neutral-400 text-sm leading-relaxed">
              Summify is a web-based AI summarizer that transforms lengthy documents into clear, concise insights in seconds.
            </p>
          </div>
        </div>

        <svg className="absolute top-0 right-0 w-full h-full pointer-events-none opacity-[0.02]" viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern height="40" id="grid" patternUnits="userSpaceOnUse" width="40">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"></path>
            </pattern>
          </defs>
          <rect fill="url(#grid)" height="100%" width="100%"></rect>
        </svg>
      </section>

      {/* Mobile Floating Interaction */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 w-max px-6 py-3 bg-neutral-900 border border-neutral-800 rounded-full shadow-lg z-50 flex items-center gap-4">
        <span className="text-xs font-bold tracking-wider text-neutral-400">SECURE CLOUD</span>
        <div className="w-1.5 h-1.5 rounded-full bg-[#73D9B7] animate-pulse-primary"></div>
        <span className="text-xs font-bold tracking-wider text-neutral-400">LOCAL AI</span>
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
          border-color: #73D9B7 !important;
          box-shadow: 0 0 0 3px rgba(115, 217, 183, 0.15) !important;
        }
      `}</style>
    </main>
  );
}