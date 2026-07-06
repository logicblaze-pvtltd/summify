import React, { useMemo, useState } from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel, StatusPill } from '../components';

export default function AdminDocumentsPage() {
  const { state, actions } = useAdmin();
  const [query, setQuery] = useState('');

  const docs = useMemo(() => {
    const q = query.toLowerCase();
    return state.documents.filter((doc) =>
      doc.fileName.toLowerCase().includes(q) || doc.owner.toLowerCase().includes(q) || doc.status.toLowerCase().includes(q),
    );
  }, [state.documents, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Documents</h2>
          <p className="text-on-surface-variant mt-1">Review uploaded files, moderation state, and cleanup actions.</p>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documents..."
          className="px-4 py-2 rounded-xl border border-outline-variant/30 bg-white/80 dark:bg-surface-container-highest/70 outline-none focus:border-primary"
        />
      </div>

      <Panel title={`Document Queue (${docs.length})`} description="Operational document management.">
        <div className="space-y-3">
          {docs.map((doc) => (
            <div key={doc.id} className="p-4 rounded-2xl border border-outline-variant/20 bg-surface-container-low/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold">{doc.fileName}</p>
                  <StatusPill tone={doc.status === 'Ready' ? 'green' : doc.status === 'Flagged' ? 'red' : 'orange'}>{doc.status}</StatusPill>
                </div>
                <p className="text-[11px] text-on-surface-variant mt-1">Owner: {doc.owner} · {doc.pages} pages · {doc.size} · Risk: {doc.risk}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => actions.updateDocumentStatus(doc.id, 'Ready')}
                  className="px-3 py-2 rounded-lg border border-outline-variant/30 text-sm hover:bg-surface-container"
                >
                  Mark Ready
                </button>
                <button
                  onClick={() => actions.updateDocumentStatus(doc.id, 'Flagged')}
                  className="px-3 py-2 rounded-lg border border-error/20 text-sm text-error hover:bg-error/10"
                >
                  Flag
                </button>
                <button
                  onClick={() => actions.deleteDocument(doc.id)}
                  className="px-3 py-2 rounded-lg border border-outline-variant/30 text-sm hover:bg-surface-container"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
