import React, { useState, useEffect } from 'react';
import { useAdmin } from '../AdminProvider';
import { Panel } from '../components';

export default function AdminSettingsPage() {
  const { state, actions } = useAdmin();

  // Local draft so changes are only sent on explicit save
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Sync draft whenever server state arrives / changes
  useEffect(() => {
    if (state?.settings) {
      setDraft(state.settings);
    }
  }, [state?.settings]);

  if (!draft) return null;

  const set = (key, value) => {
    setSaved(false);
    setSaveError(null);
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      await actions.saveSettings(draft);
      setSaved(true);
    } catch (err) {
      setSaveError(err.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold">Portal Settings</h2>
          <p className="text-on-surface-variant mt-1">Adjust portal behaviour and feature flags.</p>
        </div>

        <div className="flex items-center gap-3">
          {saveError && (
            <p className="text-sm text-error font-medium">{saveError}</p>
          )}
          {saved && !saveError && (
            <p className="text-sm text-green-600 font-medium flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px]">check_circle</span>
              Saved
            </p>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-95 transition-opacity disabled:opacity-60 flex items-center gap-2"
          >
            {saving && (
              <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
            )}
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>

      <Panel title="Security & Platform" description="Core admin-controlled settings.">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <label className="space-y-2">
            <span className="text-sm font-medium">Portal Name</span>
            <input
              value={draft.portalName}
              onChange={(e) => set('portalName', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-white/80 dark:bg-surface-container-highest/70 outline-none focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Model Name</span>
            <input
              value={draft.modelName}
              onChange={(e) => set('modelName', e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-white/80 dark:bg-surface-container-highest/70 outline-none focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">Auto Purge Days</span>
            <input
              type="number"
              min={1}
              value={draft.autoPurgeDays}
              onChange={(e) => set('autoPurgeDays', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-white/80 dark:bg-surface-container-highest/70 outline-none focus:border-primary"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium">API Rate Limit (req / min)</span>
            <input
              type="number"
              min={1}
              value={draft.apiRateLimit}
              onChange={(e) => set('apiRateLimit', Number(e.target.value))}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant/30 bg-white/80 dark:bg-surface-container-highest/70 outline-none focus:border-primary"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
          {/* Maintenance Mode toggle */}
          <button
            onClick={() => set('maintenanceMode', !draft.maintenanceMode)}
            className={`p-4 rounded-2xl border text-left transition-colors ${
              draft.maintenanceMode
                ? 'border-error/30 bg-error/5'
                : 'border-outline-variant/20 hover:bg-surface-container-low/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold">Maintenance Mode</p>
              <span
                className={`w-9 h-5 rounded-full flex items-center transition-colors ${
                  draft.maintenanceMode ? 'bg-error' : 'bg-outline-variant/40'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${
                    draft.maintenanceMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {draft.maintenanceMode ? 'Site is in maintenance' : 'Site is live'}
            </p>
          </button>

          {/* Guest Uploads toggle */}
          <button
            onClick={() => set('guestUploadsEnabled', !draft.guestUploadsEnabled)}
            className={`p-4 rounded-2xl border text-left transition-colors ${
              draft.guestUploadsEnabled
                ? 'border-primary/20 bg-primary/5'
                : 'border-outline-variant/20 hover:bg-surface-container-low/60'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold">Guest Uploads</p>
              <span
                className={`w-9 h-5 rounded-full flex items-center transition-colors ${
                  draft.guestUploadsEnabled ? 'bg-primary' : 'bg-outline-variant/40'
                }`}
              >
                <span
                  className={`w-4 h-4 rounded-full bg-white shadow transition-transform mx-0.5 ${
                    draft.guestUploadsEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </span>
            </div>
            <p className="text-[11px] text-on-surface-variant">
              {draft.guestUploadsEnabled ? 'Enabled' : 'Disabled'}
            </p>
          </button>

          {/* Encryption — display only, not toggleable */}
          <div className="p-4 rounded-2xl border border-outline-variant/20 text-left">
            <p className="font-semibold">Encryption</p>
            <p className="text-[11px] text-on-surface-variant mt-1">{draft.encryption}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
