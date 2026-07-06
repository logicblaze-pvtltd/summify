import React from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel, StatusPill } from '../components';

export default function AdminAuditPage() {
  const { state } = useAdmin();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl md:text-3xl font-bold">Audit Log</h2>
        <p className="text-on-surface-variant mt-1">Track sensitive changes, warnings, and operational notes.</p>
      </div>

      <Panel title="Event Timeline" description="Latest important admin and system events.">
        <div className="space-y-3">
          {state.audit.map((item) => (
            <div key={item.id} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40">
              <div>
                <p className="font-semibold">{item.actor}</p>
                <p className="text-[11px] text-on-surface-variant">{item.event}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusPill tone={item.severity === 'High' ? 'red' : item.severity === 'Warning' ? 'orange' : 'primary'}>
                  {item.severity}
                </StatusPill>
                <p className="text-[11px] text-on-surface-variant">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
