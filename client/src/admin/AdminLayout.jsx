import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from './AdminProvider';

const navSections = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', icon: 'dashboard', label: 'Dashboard' },
      { to: '/admin/usage', icon: 'analytics', label: 'Usage Stats' },
    ],
  },
  {
    title: 'Management',
    items: [
      { to: '/admin/users', icon: 'group', label: 'User Directory' },
      { to: '/admin/documents', icon: 'description', label: 'Documents' },
      { to: '/admin/subscriptions', icon: 'payments', label: 'Subscriptions' },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/settings', icon: 'settings', label: 'Portal Settings' },
      { to: '/admin/api', icon: 'dns', label: 'API & Engine' },
      { to: '/admin/audit', icon: 'fact_check', label: 'Audit Log' },
    ],
  },
];

function SidebarLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      end={to === '/admin'}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl font-medium transition-colors ${
          isActive
            ? 'bg-primary/10 text-primary shadow-sm'
            : 'text-on-surface-variant hover:bg-surface-container'
        }`
      }
    >
      <span className="material-symbols-outlined text-[22px]">{icon}</span>
      <span className="text-sm">{label}</span>
    </NavLink>
  );
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const { state, loading, user } = useAdmin();

  // Read theme from localStorage — same key App.jsx uses
  const [isDark, setIsDark] = useState(() => localStorage.getItem('theme') === 'dark');

  // Stay in sync if the user changes theme in another tab or in the main app
  useEffect(() => {
    const sync = () => setIsDark(localStorage.getItem('theme') === 'dark');
    window.addEventListener('storage', sync);
    // Also watch the html element class in case App.jsx changes it in same tab
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      window.removeEventListener('storage', sync);
      observer.disconnect();
    };
  }, []);

  // Derive avatar initials from the real admin user name
  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className={`min-h-screen bg-background text-on-surface flex${isDark ? ' dark dark-mode' : ''}`}>
      <aside
        className="admin-sidebar hidden lg:flex w-[280px] fixed inset-y-0 left-0 flex-col border-r border-outline-variant/30 z-40"
        style={{
          background: 'linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, var(--surface-container) 60%, transparent) 100%)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div className="h-16 flex items-center px-6 border-b border-outline-variant/20">
          {/* Same Summify SVG logo as main app Sidebar */}
          <div className="flex items-center gap-2 overflow-hidden" style={{ height: 48 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 250" width="140" height="44">
              <defs>
                <linearGradient id="adminSumifyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#47AF8F" />
                  <stop offset="100%" stopColor="#067357" />
                </linearGradient>
                <filter id="adminSoftShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="3" dy="8" stdDeviation="6" floodColor="#73D9B7" floodOpacity="0.12" />
                </filter>
              </defs>
              <g transform="translate(50, 45)" filter="url(#adminSoftShadow)">
                <rect x="10" y="10" width="100" height="140" rx="14" fill="#067357" opacity="0.2" />
                <rect x="26" y="25" width="100" height="120" rx="12" fill="url(#adminSumifyGrad)" opacity="0.4" />
                <rect x="42" y="40" width="100" height="100" rx="10" fill="#73D9B7" />
                <line x1="62" y1="68" x2="112" y2="68" stroke="#F5F6FB" strokeWidth="5.5" strokeLinecap="round" opacity="0.9" />
                <line x1="62" y1="85" x2="102" y2="85" stroke="#F5F6FB" strokeWidth="5.5" strokeLinecap="round" opacity="0.9" />
                <line x1="62" y1="102" x2="87" y2="102" stroke="url(#adminSumifyGrad)" strokeWidth="6.5" strokeLinecap="round" />
              </g>
              <text x="215" y="152" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="120" fontWeight="800" fill="#73D9B7" letterSpacing="-2.5">
                Summ<tspan fill="url(#adminSumifyGrad)">ify</tspan>
              </text>
              <text x="220" y="192" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="24" fontWeight="700" fill="#067357" letterSpacing="5" opacity="0.8">
                PDF SUMMARIZER
              </text>
            </svg>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-4 space-y-5">
          {navSections.map((section) => (
            <div key={section.title}>
              <div className="px-3 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-on-surface-variant/60">
                {section.title}
              </div>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <SidebarLink key={item.to} {...item} />
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-outline-variant/20">
          <div className="rounded-2xl bg-surface-container/20 border border-outline-variant/10 p-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 ring-2 ring-primary/5">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate text-on-surface">{user?.name || 'Admin'}</p>
                <p className="text-[11px] text-outline truncate">{user?.email || ''}</p>
              </div>
            </div>
            <button
              onClick={() => navigate('/')}
              className="mt-3 w-full py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-95 transition-opacity flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Exit Admin
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 lg:ml-[280px] min-w-0">
        <header
          className="admin-header sticky top-0 z-30 h-16 border-b border-outline-variant/20"
          style={{
            background: 'linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, var(--surface-container) 60%, transparent) 100%)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <div className="h-full px-4 md:px-8 flex items-center justify-between">
            <div>
              <h1 className="text-lg md:text-xl font-bold">Dashboard Overview</h1>
              <p className="text-[11px] md:text-sm text-on-surface-variant">A compact control center for Lumina AI operations.</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wide">{state?.api?.clusterStatus ?? 'Loading…'}</span>
              </div>
              <button className="p-2 rounded-full hover:bg-surface-container transition-colors">
                <span className="material-symbols-outlined">notifications</span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-4 md:p-8 max-w-[1440px] mx-auto w-full">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-on-surface-variant">
              <span className="w-10 h-10 rounded-full border-4 border-primary/30 border-t-primary animate-spin" />
              <p className="text-sm font-medium">Loading admin data…</p>
            </div>
          ) : state?.error || !state ? (
            <div className="flex flex-col items-center justify-center h-64 gap-4 text-error">
              <span className="material-symbols-outlined text-5xl">error</span>
              <p className="font-semibold">Failed to load admin data</p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold"
              >
                Retry
              </button>
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      </div>
    </div>
  );
}
