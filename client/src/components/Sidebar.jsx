import React from 'react';

export default function Sidebar({ currentView, onViewChange, onNewSummary, isCollapsed, onToggleCollapse }) {
  return (
    <aside
      className={`h-screen sticky left-0 top-0 border-r border-outline-variant bg-surface-container-low/40 flex flex-col py-8 px-5 z-40 hidden md:flex shrink-0 transition-all duration-300 ${
        isCollapsed ? 'w-20' : 'w-[280px]'
      }`}
      id="sidebar"
       style={{ background: 'linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, var(--surface-container) 60%, transparent) 100%)' }}
    >
      {/* Sidebar Header */}
      <div className={`mb-12 px-2 sidebar-header flex items-center justify-between ${isCollapsed ? 'justify-center' : ''}`}>
        <div className="flex items-center gap-2 overflow-hidden">
          <span className="material-symbols-outlined fill-icon text-primary shrink-0">analytics</span>
          {!isCollapsed && (
            <div className="sidebar-header-text animate-in fade-in duration-200">
              <h1 className="text-title-sm font-bold text-primary whitespace-nowrap">LocalAI PDF</h1>
              <p className="text-[10px] uppercase tracking-[0.1em] text-outline font-bold mt-1">Enterprise Privacy</p>
            </div>
          )}
        </div>
        {!isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-surface-container rounded-lg text-outline transition-colors hidden xl:block"
            id="desktop-toggle"
          >
            <span className="material-symbols-outlined">menu_open</span>
          </button>
        )}
        {isCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-surface-container rounded-lg text-outline transition-colors"
          >
            <span className="material-symbols-outlined">menu</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-grow space-y-2 overflow-hidden">
        {/* Dashboard */}
        <button
          onClick={() => onViewChange('dashboard')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
            currentView === 'dashboard'
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          } ${isCollapsed ? 'justify-center pl-0 pr-0' : ''}`}
          title="Dashboard"
        >
          <span
            className={`material-symbols-outlined transition-colors ${
              currentView === 'dashboard' ? 'fill-icon text-primary' : 'group-hover:text-primary'
            }`}
          >
            dashboard
          </span>
          {!isCollapsed && <span className="text-body-sm sidebar-label font-semibold">Dashboard</span>}
        </button>

        {/* Library */}
        <button
          onClick={() => onViewChange('library')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
            currentView === 'library'
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          } ${isCollapsed ? 'justify-center pl-0 pr-0' : ''}`}
          title="My Library"
        >
          <span
            className={`material-symbols-outlined transition-colors ${
              currentView === 'library' ? 'fill-icon text-primary' : 'group-hover:text-primary'
            }`}
          >
            library_books
          </span>
          {!isCollapsed && <span className="text-body-sm sidebar-label font-semibold">My Library</span>}
        </button>

        {/* Settings */}
        <button
          onClick={() => onViewChange('settings')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
            currentView === 'settings'
              ? 'bg-primary/10 text-primary font-semibold'
              : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/60'
          } ${isCollapsed ? 'justify-center pl-0 pr-0' : ''}`}
          title="Settings"
        >
          <span
            className={`material-symbols-outlined transition-colors ${
              currentView === 'settings' ? 'fill-icon text-primary' : 'group-hover:text-primary'
            }`}
          >
            settings
          </span>
          {!isCollapsed && <span className="text-body-sm sidebar-label font-semibold">Settings</span>}
        </button>
      </nav>

      {/* New Summary Button */}
      <div className="mt-auto space-y-6">
        <button
          onClick={onNewSummary}
          className={`bg-primary-container text-white hover:opacity-90 font-bold py-3.5 px-4 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all shadow-lg shadow-primary/20 new-summary-btn ${
            isCollapsed ? 'w-12 h-12 p-0' : 'w-full'
          }`}
          title="New Summary"
        >
          <span className="material-symbols-outlined">add</span>
          {!isCollapsed && <span className="text-body-sm new-summary-text">New Summary</span>}
        </button>
      </div>
    </aside>
  );
}
