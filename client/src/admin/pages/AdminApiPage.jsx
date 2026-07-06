import React from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel, StatusPill } from '../components';

export default function AdminApiPage() {
  const { state } = useAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold">API & Engine</h2>
        <p className="text-on-surface-variant mt-1">Live system health, throughput, and model controls.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Panel title="Live Cluster" description="Infrastructure and processing runtime.">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">dns</span>
            </div>
            <div>
              <p className="font-bold text-xl">{state.api.clusterStatus}</p>
              <p className="text-sm text-on-surface-variant">{state.api.processingCore}</p>
            </div>
          </div>
        </Panel>

        <Panel title="Model Controls" description="Current summarization engine configuration.">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Default Model</span>
              <StatusPill tone="primary">{state.settings.modelName}</StatusPill>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Encryption</span>
              <StatusPill tone="green">{state.settings.encryption}</StatusPill>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Rate Limit</span>
              <StatusPill tone="blue">{state.settings.apiRateLimit}/min</StatusPill>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Endpoint Metrics" description="Per-route request volume and error rate.">
        <div className="space-y-3">
          {state.api.endpoints.map((endpoint) => (
            <div key={endpoint.path} className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-semibold font-mono text-sm">{endpoint.path}</p>
                  <p className="text-[11px] text-on-surface-variant">{endpoint.requests.toLocaleString()} requests</p>
                </div>
                <p className="text-sm font-semibold">{endpoint.errors} errors</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
