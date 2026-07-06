import React from 'react';

export function StatCard({ icon, label, value, subtext, tone = 'primary' }) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-500/10 text-blue-600',
    orange: 'bg-orange-500/10 text-orange-600',
    green: 'bg-green-500/10 text-green-600',
    red: 'bg-red-500/10 text-red-600',
  };

  return (
    <div className="rounded-2xl border border-outline-variant/40 glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${toneClasses[tone]}`}>
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Live</span>
      </div>
      <p className="text-sm text-on-surface-variant font-medium">{label}</p>
      <h3 className="text-2xl font-bold mt-1">{value}</h3>
      {subtext && <p className="text-[11px] text-on-surface-variant mt-2">{subtext}</p>}
    </div>
  );
}

export function Panel({ title, description, children, actions }) {
  return (
    <section className="rounded-3xl border border-outline-variant/40 glass-card overflow-hidden">
      <div className="px-5 md:px-6 py-4 border-b border-outline-variant/30 flex items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-lg">{title}</h3>
          {description && <p className="text-sm text-on-surface-variant">{description}</p>}
        </div>
        {actions}
      </div>
      <div className="p-5 md:p-6">{children}</div>
    </section>
  );
}

export function StatusPill({ tone = 'primary', children }) {
  const toneClasses = {
    primary: 'bg-primary/10 text-primary',
    blue: 'bg-blue-500/10 text-blue-600',
    orange: 'bg-orange-500/10 text-orange-600',
    green: 'bg-green-500/10 text-green-600',
    red: 'bg-red-500/10 text-red-600',
    gray: 'bg-surface-container text-on-surface-variant',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}
