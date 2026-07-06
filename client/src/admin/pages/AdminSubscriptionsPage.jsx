import React from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel, StatCard, StatusPill } from '../components';

export default function AdminSubscriptionsPage() {
  const { state } = useAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold">Subscriptions</h2>
        <p className="text-on-surface-variant mt-1">Monitor revenue mix, invoices, and plan health.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <StatCard icon="payments" label="MRR" value={`$${state.overview.mrr.toLocaleString()}`} subtext="Monthly recurring revenue" tone="blue" />
        <StatCard icon="groups" label="Active Subscribers" value={state.overview.activeUsers.toLocaleString()} subtext="Across all paid plans" tone="green" />
        <StatCard icon="percent" label="Churn" value="2.1%" subtext="Trailing 30 days" tone="orange" />
      </div>

      <Panel title="Invoices" description="Recent customer billing events.">
        <div className="space-y-3">
          {state.subscriptions.invoices.map((invoice) => (
            <div key={invoice.id} className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{invoice.customer}</p>
                <p className="text-[11px] text-on-surface-variant">{invoice.id} · {invoice.date}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold">{invoice.amount}</p>
                <StatusPill tone={invoice.status === 'Paid' ? 'green' : invoice.status === 'Due' ? 'orange' : 'gray'}>
                  {invoice.status}
                </StatusPill>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
