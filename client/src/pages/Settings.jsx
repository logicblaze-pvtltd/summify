import React, { useState, useEffect } from 'react';
import { useFeedback } from '../components/FeedbackProvider';
import { apiFetch } from '../lib/api';

export default function Settings({ theme, onThemeChange, refreshDocuments }) {
  const { showAlert, showConfirm, showToast } = useFeedback();
  const [config, setConfig] = useState({
    autoPurgeDays: 'Never',
    onDiskEncryption: true
  });
  
  const [saving, setSaving] = useState(false);

  // Fetch settings from server
  useEffect(() => {
    apiFetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        if (data) {
          setConfig(data);
        }
      })
      .catch(err => console.error('Error fetching settings:', err));
  }, []);

  const handleChange = (field, val) => {
    setConfig(prev => ({
      ...prev,
      [field]: val
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
      if (res.ok) {
        showToast({
          title: 'Settings saved',
          message: 'Configurations saved successfully!',
          tone: 'success'
        });
      } else {
        throw new Error('Failed to save settings.');
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      void showAlert({
        title: 'Save failed',
        message: err.message || 'Failed to save settings.',
        tone: 'danger',
        confirmText: 'Close'
      });
    } finally {
      setSaving(false);
    }
  };

  const handleWipeData = async () => {
    const confirmed = await showConfirm({
      title: 'Wipe all app data?',
      message: 'CAUTION: This will irreversibly delete all PDF indexes, summaries, and chat history. Continue?',
      tone: 'danger',
      confirmText: 'Wipe Data',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        const docsRes = await apiFetch('/api/documents');
        if (!docsRes.ok) {
          throw new Error('Unable to load documents for deletion.');
        }
        const docs = await docsRes.json();
        const deletePromises = docs.map((doc) =>
          apiFetch(`/api/documents/${doc.id}`, { method: 'DELETE' })
        );
        const deleteResults = await Promise.all(deletePromises);
        if (!deleteResults.every((result) => result.ok)) {
          throw new Error('Some documents could not be deleted.');
        }
        refreshDocuments();
        showToast({
          title: 'Data wiped',
          message: 'All database files successfully wiped.',
          tone: 'success'
        });
      } catch (err) {
        console.error('Wipe data error:', err);
        void showAlert({
          title: 'Wipe failed',
          message: err.message || 'Failed to wipe data.',
          tone: 'danger',
          confirmText: 'Close'
        });
      }
    }
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto w-full space-y-8 pb-16">
      
      {/* Settings Header */}
      <div>
        <h2 className="text-display-lg font-bold text-on-surface mb-2">Settings</h2>
        <p className="text-on-surface-variant text-body-md">Configure your theme, file management rules, and retention metrics.</p>
      </div>

      <div className="space-y-6">
        
        {/* Privacy & Security */}
        <section className="bg-surface-container-highest border border-outline-variant rounded-xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-400/30 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                security
              </span>
              <h3 className="text-title-sm font-bold text-on-surface">Privacy &amp; Security</h3>
            </div>
          </div>
          
          <div className="divide-y divide-outline-variant/30 dark:divide-gray-700">
            
            {/* Toggle Encryption */}
            <div className="p-6 flex items-center justify-between hover:bg-surface-container-low/30 transition-colors">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">encrypted</span>
                </div>
                <div>
                  <p className="font-bold text-body-md text-on-surface">Data Store Encryption</p>
                  <p className="text-body-sm text-outline">Encrypt document models and textual summary indices inside server arrays using AES-256 standard.</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.onDiskEncryption}
                  onChange={(e) => handleChange('onDiskEncryption', e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-container-highest peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-surface-container-highest after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-surface-container-highest after:border-outline-variant after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Auto Purge History */}
            <div className="p-6 flex items-center justify-between hover:bg-surface-container-low/30 transition-colors">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined">history_toggle_off</span>
                </div>
                <div>
                  <p className="font-bold text-body-md text-on-surface">Auto-Purge History</p>
                  <p className="text-body-sm text-outline">Automatically delete cached summaries older than a specified period.</p>
                </div>
              </div>
              <div className="relative">
                <select
                  value={config.autoPurgeDays}
                  onChange={(e) => handleChange('autoPurgeDays', e.target.value)}
                  className="p-2 pr-8 bg-surface border border-outline-variant rounded-lg text-body-sm appearance-none focus:border-primary outline-none"
                >
                  <option value="Never">Never</option>
                  <option value="7 Days">7 Days</option>
                  <option value="30 Days">30 Days</option>
                  <option value="90 Days">90 Days</option>
                </select>
                <span className="material-symbols-outlined absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-outline text-lg">
                  expand_more
                </span>
              </div>
            </div>

            {/* Wipe database */}
            <div className="p-6 flex items-center justify-between bg-error/5">
              <div className="flex gap-4 items-center">
                <div className="w-10 h-10 rounded-lg bg-error/10 flex items-center justify-center text-error">
                  <span className="material-symbols-outlined">delete_forever</span>
                </div>
                <div>
                  <p className="font-bold text-body-md text-error">Wipe All App Data</p>
                  <p className="text-body-sm text-outline">Irreversibly clean up all document vector indexes, parsed text buffers, and response logs from the system.</p>
                </div>
              </div>
              <button
                onClick={handleWipeData}
                className="px-5 py-2 text-error font-bold border-2 border-error/20 dark:border-red-800 dark:text-red-600/80 rounded-lg hover:border-error hover:bg-error/5 transition-all text-sm active:scale-95"
              >
                Wipe Data
              </button>
            </div>

          </div>
        </section>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Appearance Section */}
          <section className="bg-surface-container-highest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-400/30 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  palette
                </span>
                <h3 className="text-title-sm font-bold text-on-surface">Appearance</h3>
              </div>
            </div>
            
            <div className="p-6 space-y-6 flex-grow flex flex-col justify-center">
              <div className="flex items-center justify-between">
                <span className="text-body-md font-medium text-on-surface">Interface Theme</span>
                <div className="flex p-1 bg-surface-container-low border border-outline-variant rounded-lg">
                  <button
                    onClick={() => onThemeChange('light')}
                    className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 font-bold transition-all ${
                      theme === 'light' ? 'bg-surface-container-highest shadow-sm text-primary' : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">light_mode</span> Light
                  </button>
                  <button
                    onClick={() => onThemeChange('dark')}
                    className={`px-3 py-1.5 rounded-md text-xs flex items-center gap-1.5 font-bold transition-all ${
                      theme === 'dark' ? 'bg-surface-container-highest shadow-sm text-primary' : 'text-outline hover:text-on-surface'
                    }`}
                  >
                    <span className="material-symbols-outlined text-sm">dark_mode</span> Dark
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* Upgraded Clean Storage Management & Retention Card */}
          <section className="bg-surface-container-highest border border-outline-variant rounded-xl shadow-sm overflow-hidden flex flex-col">
            <div className="px-6 py-5 border-b border-gray-400/30 dark:border-gray-700">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  storage
                </span>
                <h3 className="text-title-sm font-bold text-on-surface">Storage Management</h3>
              </div>
            </div>
            
            <div className="p-6 space-y-6 flex-grow flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-body-sm font-bold text-on-surface">Workspace Allocation</span>
                    <span className="text-[11px] px-2.5 py-0.5 font-mono font-bold bg-primary/10 text-primary border border-primary/20 rounded">Cloud Synced</span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant leading-relaxed">
                    All document vectors, metadata schema structures, and context caches are preserved securely inside your authenticated space.
                  </p>
                </div>
                
                <div className="grid grid-cols-1 gap-2 bg-surface-container-low/50 p-3 rounded-lg border border-gray-400/30 dark:border-gray-700 text-xs">
                  <div className="flex justify-between items-center text-on-surface-variant font-medium">
                    <span>Database Engine Pipeline</span>
                    <span className="font-mono text-primary font-bold">Relational Vector Cluster</span>
                  </div>
                  <div className="flex justify-between items-center text-on-surface-variant font-medium">
                    <span>Global Activity Logging</span>
                    <span className="font-mono text-emerald-500 font-bold">STANDARD SECURITY</span>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-end gap-4 py-8 border-t border-gray-400/30 dark:border-gray-700">
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2.5 rounded-lg text-on-surface-variant font-bold hover:bg-surface-container-high transition-colors text-sm"
          >
            Discard Changes
          </button>
          
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-10 py-3 rounded-xl bg-primary text-on-primary font-bold shadow-lg shadow-primary/20 hover:shadow-primary/30 hover:bg-primary/95 active:scale-95 transition-all text-sm flex items-center gap-2"
          >
            <span>{saving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
