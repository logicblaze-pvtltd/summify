import React from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel, StatCard, StatusPill } from '../components';

const bars = [40, 55, 70, 60, 85, 45, 65, 50, 90, 55, 40, 75, 60, 45, 95, 70];

export default function AdminDashboardPage() {
  const { state } = useAdmin();

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Good morning, Admin</h2>
          <p className="text-on-surface-variant mt-1">Here is what is happening with Lumina AI today.</p>
        </div>
        <div className="flex gap-3">
          <button className="px-4 py-2 glass-card border border-outline-variant/20 rounded-xl text-sm font-medium hover:bg-surface-container transition-colors flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            Last 30 Days
          </button>
          <button className="px-4 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-95 transition-opacity flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <StatCard icon="person" label="Total Platform Users" value={state.overview.totalUsers.toLocaleString()} subtext={`+${state.overview.growth}% this month`} tone="primary" />
        <StatCard icon="payments" label="Monthly Revenue" value={`$${state.overview.mrr.toLocaleString()}`} subtext={`Active: ${state.overview.activeUsers.toLocaleString()} subscriptions`} tone="blue" />
        <StatCard icon="description" label="Documents Processed" value={state.overview.documentsProcessed.toLocaleString()} subtext={`Avg. 2.4s per document`} tone="orange" />
        <StatCard icon="check_circle" label="API System Health" value={`${state.overview.apiHealth}%`} subtext={`Current latency: ${state.overview.avgLatency}ms`} tone="green" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <Panel
          title="System Utilization"
          description="Real-time inference requests across nodes."
          actions={
            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-primary" />CPU Load</div>
              <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full bg-secondary-container" />GPU Load</div>
            </div>
          }
        >
          {/* Fixed height container so bars never stretch the card */}
          <div className="h-48 flex items-end gap-1.5">
            {bars.map((bar, index) => (
              <div key={index} className="flex-1 bg-primary/15 rounded-t-lg relative" style={{ height: '100%' }}>
                <div
                  className="absolute bottom-0 left-0 right-0 bg-primary rounded-t-lg transition-all"
                  style={{ height: `${bar}%` }}
                />
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-3 text-[10px] font-semibold text-on-surface-variant/60 uppercase tracking-widest">
            <span>08:00 AM</span>
            <span>10:00 AM</span>
            <span>12:00 PM</span>
            <span>02:00 PM</span>
            <span>Now</span>
          </div>
        </Panel>

        <div className="space-y-5">
          <Panel title="Plan Distribution" description="Current customer mix by subscription tier.">
            <div className="space-y-4">
              {state.subscriptions.plans.map((plan) => (
                <div key={plan.name}>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-on-surface-variant">{plan.value}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-surface-container rounded-full overflow-hidden">
                    <div className={`h-full ${plan.color}`} style={{ width: `${plan.value}%` }} />
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full mt-6 py-2 border border-outline-variant/30 rounded-xl text-xs font-semibold hover:bg-surface-container transition-colors">
              Manage Plans
            </button>
          </Panel>

          <div className="rounded-3xl bg-primary p-6 shadow-sm text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="font-bold text-sm opacity-90">Cloud Sync Status</h3>
              <div className="flex items-center gap-2 mt-4">
                <span className="material-symbols-outlined text-3xl">cloud_done</span>
                <div>
                  <p className="text-xl font-bold">Encrypted</p>
                  <p className="text-[10px] opacity-80 uppercase font-bold tracking-widest">Active AES-256</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <span className="material-symbols-outlined text-[100px]">shield</span>
            </div>
          </div>
        </div>

        {/* Recent Activity — fixed height, scrollable */}
        <Panel title="Recent Activity" description="Latest operational events across the platform.">
          <div className="h-64 overflow-y-auto space-y-3 pr-1 custom-scrollbar">
            {state.activity.map((item) => (
              <div key={item.id} className="flex items-start justify-between gap-4 p-3 rounded-2xl bg-surface-container-low/60 border border-outline-variant/20">
                <div className="min-w-0">
                  <p className="font-semibold text-sm truncate">{item.user}</p>
                  <p className="text-[11px] text-on-surface-variant truncate">{item.action} · {item.target}</p>
                </div>
                <div className="text-right shrink-0">
                  <StatusPill tone={item.status === 'Failed' ? 'red' : 'primary'}>{item.status}</StatusPill>
                  <p className="text-[11px] text-on-surface-variant mt-1">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
