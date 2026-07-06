import React from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel, StatCard, StatusPill } from '../components';

export default function AdminUsagePage() {
  const { state } = useAdmin();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold">Usage Stats</h2>
        <p className="text-on-surface-variant mt-1">Traffic, processing, and feature adoption overview.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard icon="trending_up" label="Document Growth" value={`+${state.overview.docGrowth}%`} subtext="Compared with previous month" tone="primary" />
        <StatCard icon="timer" label="Avg Upload Latency" value="2.4s" subtext="Across all active clusters" tone="blue" />
        <StatCard icon="shield" label="Blocked Events" value="17" subtext="Automated security filters" tone="red" />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Panel title="Plan Distribution" description="How the user base is split across plans.">
          <div className="space-y-4">
            {state.subscriptions.plans.map((plan) => (
              <div key={plan.name}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="font-medium">{plan.name}</span>
                  <span className="text-on-surface-variant">{plan.value}%</span>
                </div>
                <div className="h-2 w-full bg-surface-container rounded-full overflow-hidden">
                  <div className={`h-full ${plan.color}`} style={{ width: `${plan.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="API Health" description="Service level status across the stack.">
          <div className="space-y-3">
            {state.api.health.map((service) => (
              <div key={service.name} className="flex items-center justify-between gap-4 p-3 rounded-2xl bg-surface-container-low/50 border border-outline-variant/20">
                <div>
                  <p className="font-semibold text-sm">{service.name}</p>
                  <p className="text-[11px] text-on-surface-variant">Latency: {service.latency}</p>
                </div>
                <StatusPill tone={service.status === 'Healthy' ? 'green' : service.status === 'Degraded' ? 'orange' : 'red'}>
                  {service.status}
                </StatusPill>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
