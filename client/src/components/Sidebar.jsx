import React from 'react';
import { NavLink } from 'react-router-dom';

function NavItem({ to, icon, label, isCollapsed }) {
  return (
    <NavLink
      to={to}
      end={to === '/'}
      className={({ isActive }) =>
        `w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${isActive
          ? 'bg-primary/10 text-primary font-semibold shadow-sm'
          : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
        } ${isCollapsed ? 'justify-center px-0' : ''}`
      }
      title={label}
    >
      {({ isActive }) => (
        <>
          <span
            className={`material-symbols-outlined transition-transform duration-300 group-hover:scale-105 ${isActive ? 'fill-icon text-primary' : 'group-hover:text-primary'
              }`}
          >
            {icon}
          </span>
          {!isCollapsed && (
            <span className="text-body-sm sidebar-label font-semibold tracking-wide animate-in fade-in slide-in-from-left-2 duration-200">
              {label}
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export default function Sidebar({
  isCollapsed,
  onToggleCollapse,
  user,        // User object (e.g., { name: 'John Doe', email: '...' }) or null
  onLogin,     // Trigger login function
  onLogout     // Trigger logout function
}) {
  return (
    <aside
      className={`h-screen sticky left-0 top-0 border-r border-outline-variant/30 flex flex-col py-8 px-4 z-40 hidden md:flex shrink-0 transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-[280px]'
        }`}
      id="sidebar"
      style={{
        background:
          'linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, var(--surface-container) 60%, transparent) 100%)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Sidebar Header */}
      <div className={`mb-10 px-2 sidebar-header flex items-center justify-between ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center gap-3 overflow-hidden">
          <svg className="" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 250" width="100%" height="100%">
            <defs>
              <linearGradient id="sumifyGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#47AF8F" />
                <stop offset="100%" stopColor="#067357" />
              </linearGradient>

              <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="3" dy="8" stdDeviation="6" floodColor="#73D9B7" floodOpacity="0.12" />
              </filter>
            </defs>


            {/* <rect width="100%" height="100%" fill="#F5F6FB" rx="24" />  */}

            <g transform="translate(50, 45)" filter="url(#softShadow)">
              <rect x="10" y="10" width="100" height="140" rx="14" fill="#067357" opacity="0.2" />

              <rect x="26" y="25" width="100" height="120" rx="12" fill="url(#sumifyGradient)" opacity="0.4" />

              <rect x="42" y="40" width="100" height="100" rx="10" fill="#73D9B7" />

              <line x1="62" y1="68" x2="112" y2="68" stroke="#F5F6FB" strokeWidth="5.5" strokeLinecap="round" opacity="0.9" />
              <line x1="62" y1="85" x2="102" y2="85" stroke="#F5F6FB" strokeWidth="5.5" strokeLinecap="round" opacity="0.9" />

              <line x1="62" y1="102" x2="87" y2="102" stroke="url(#sumifyGradient)" strokeWidth="6.5" strokeLinecap="round" />
            </g>

            {!isCollapsed && (
              <>
                <text x="215" y="152" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="120" fontWeight="800" fill="#73D9B7" letterSpacing="-2.5">
                  Summ<tspan fill="url(#sumifyGradient)">ify</tspan>
                </text>

                <text x="220" y="192" fontFamily="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif" fontSize="24" fontWeight="700" fill="#067357" letterSpacing="5" opacity="0.8">
                  PDF SUMMARIZER
                </text>
              </>
            )}
          </svg>
        </div>

        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-surface-container rounded-lg text-outline hover:text-primary transition-all duration-200 hidden xl:flex items-center justify-center"
            id="desktop-toggle"
          >
            <span className="material-symbols-outlined text-xl">menu_open</span>
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-surface-container rounded-lg text-outline hover:text-primary transition-all duration-200 flex items-center justify-center"
          >
            <span className="material-symbols-outlined text-xl">menu</span>
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="flex-grow space-y-1.5 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
        <NavItem to="/" icon="dashboard" label="Dashboard" isCollapsed={isCollapsed} />
        <NavItem to="/library" icon="library_books" label="My Library" isCollapsed={isCollapsed} />
        <NavItem to="/settings" icon="settings" label="Settings" isCollapsed={isCollapsed} />
        {user?.role === 'admin' && (
          <NavItem to="/admin" icon="admin_panel_settings" label="Admin Portal" isCollapsed={isCollapsed} />
        )}
      </nav>

      {/* Footer Area: Profile & Auth Button */}
      <div className="mt-auto pt-6 border-t border-outline-variant/20 space-y-4">
        {/* User Profile Info */}
        {user && (
          <div className={`flex items-center gap-3 p-2 rounded-xl bg-surface-container/20 border border-outline-variant/10 ${isCollapsed ? 'justify-center' : ''}`}>
            {/* Avatar */}
            <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0 ring-2 ring-primary/5">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            {/* User Details */}
            {!isCollapsed && (
              <div className="overflow-hidden min-w-0 animate-in fade-in duration-300">
                <p className="text-body-sm font-semibold text-on-surface truncate">{user.name}</p>
                <p className="text-[11px] text-outline truncate">{user.email || 'Member'}</p>
              </div>
            )}
          </div>
        )}

        {/* Dynamic Auth Button */}
        {user ? (
          <button
            onClick={onLogout}
            className={`bg-error/10 text-error hover:bg-error/20 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 ${isCollapsed ? 'w-12 h-12 p-0 mx-auto' : 'w-full'
              }`}
            title="Logout"
          >
            <span className="material-symbols-outlined text-xl">logout</span>
            {!isCollapsed && <span className="text-body-sm tracking-wide">Logout</span>}
          </button>
        ) : (
          <button
            onClick={onLogin}
            className={`bg-primary text-white hover:opacity-95 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all duration-200 shadow-md shadow-primary/10 ${isCollapsed ? 'w-12 h-12 p-0 mx-auto' : 'w-full'
              }`}
            title="Login"
          >
            <span className="material-symbols-outlined text-xl">login</span>
            {!isCollapsed && <span className="text-body-sm tracking-wide">Login</span>}
          </button>
        )}
      </div>
    </aside>
  );
}