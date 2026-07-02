import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFeedback } from '../components/FeedbackProvider';

export default function Dashboard({ onSelectDocument, documents, refreshDocuments, user, guestQuota }) {
  const navigate = useNavigate();
  const { showAlert, showConfirm, showToast } = useFeedback();
  const [dragActive, setDragActive] = useState(false);
  const [processingFile, setProcessingFile] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');
  const [uploadedCount, setUploadedCount] = useState(0);
  // Stats calculations based on actual documents
  const totalAnalyzed = documents.length;
  const guestLimit = guestQuota?.limit ?? 5;
  const guestUsed = guestQuota?.used ?? totalAnalyzed;
  const guestRemaining = guestQuota?.remaining ?? Math.max(guestLimit - guestUsed, 0);
  const guestResetLabel = guestQuota?.resetAt
    ? new Date(guestQuota.resetAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'one month';

  // Dynamic metrics based on actual processed pages
  const totalPagesProcessed = documents.reduce((sum, doc) => sum + (doc.pageCount || 1), 0);
  const estimatedPages = totalPagesProcessed;
  const hoursSaved = totalPagesProcessed > 0
    ? Math.max(totalPagesProcessed * 0.12, 0.1).toFixed(1)
    : '0.0';

  // Poll for document processing status
  useEffect(() => {
    let intervalId;
    if (processingFile) {
      intervalId = setInterval(async () => {
        try {
          const res = await fetch(`/api/documents/${processingFile.id}`);
          if (res.ok) {
            const doc = await res.json();
            setProcessingStatus(doc.status);
            if (doc.status === 'Ready for Chat') {
              setProcessingFile(null);
              setProcessingStatus('');
              refreshDocuments();
              onSelectDocument(doc.id);
            } else if (doc.status === 'Error') {
              void showAlert({
                title: 'Processing error',
                message: 'Error processing PDF: ' + (doc.text || 'Unknown error'),
                tone: 'danger',
                confirmText: 'Close'
              });
              setProcessingFile(null);
              setProcessingStatus('');
              refreshDocuments();
            }
          }
        } catch (err) {
          console.error('Error polling document status:', err);
        }
      }, 1500);
    }
    return () => clearInterval(intervalId);
  }, [processingFile]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave" || e.type === "drop") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      validateAndUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      validateAndUpload(e.target.files[0]);
    }
  };

  const validateAndUpload = (file) => {
    if (processingFile) return;
    if (file.type !== 'application/pdf') {
      showToast({
        title: 'Invalid file',
        message: 'Only PDF files are allowed.',
        tone: 'warning'
      });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      showToast({
        title: 'File too large',
        message: 'File size exceeds the 50 MB limit.',
        tone: 'warning'
      });
      return;
    }
    uploadFile(file);
  };

  const uploadFile = async (file) => {
    setProcessingFile({ name: file.name, id: null });
    setProcessingStatus('Uploading');

    const formData = new FormData();
    formData.append('pdf', file);

    try {
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        if (response.status === 403) {
          const wantsToSignUp = await showConfirm({
            title: 'Upload limit reached',
            message: (errorData.message || 'Upload limit reached.') + '\n\nWould you like to create a free account?',
            tone: 'warning',
            confirmText: 'Create Free Account',
            cancelText: 'Stay Here'
          });
          if (wantsToSignUp) {
            navigate('/register');
          }
          setProcessingFile(null);
          setProcessingStatus('');
          return;
        }
        throw new Error(errorData.message || 'Upload failed');
      }

      const data = await response.json();
      setProcessingFile({ name: file.name, id: data.id });
      setProcessingStatus(data.status);
    } catch (err) {
      console.error('Upload error:', err);
      void showAlert({
        title: 'Upload failed',
        message: err.message || 'Failed to upload file. Make sure the backend server is running.',
        tone: 'danger',
        confirmText: 'Close'
      });
      setProcessingFile(null);
      setProcessingStatus('');
    }
  };
  const handleUploadClick = (e) => {
    // Agar limit reach ho chuki hai to file dialog ko open mat hone do
    if (uploadedCount >= 5) {
      e.preventDefault(); // Default file input trigger ko rokta hai
      e.stopPropagation(); // Event bubbling stop karta hai

      setModalOpen(true); // Sirf aapka modal open hoga
      return;
    }

    // Agar limit clear hai to file input click trigger ho
    fileInputRef.current.click();
  };
  const handleDeleteDoc = async (e, id) => {
    e.stopPropagation();
    const confirmed = await showConfirm({
      title: 'Delete document?',
      message: 'Are you sure you want to delete this document? This cannot be undone.',
      tone: 'warning',
      confirmText: 'Delete',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
          refreshDocuments();
          showToast({
            title: 'Document deleted',
            message: 'The PDF was removed from your library.',
            tone: 'success'
          });
        } else {
          void showAlert({
            title: 'Delete failed',
            message: 'The document could not be deleted right now.',
            tone: 'danger',
            confirmText: 'Close'
          });
        }
      } catch (err) {
        console.error('Delete error:', err);
        void showAlert({
          title: 'Delete failed',
          message: err.message || 'Something went wrong while deleting the document.',
          tone: 'danger',
          confirmText: 'Close'
        });
      }
    }
  };

  const getProgressPercentage = (status) => {
    switch (status) {
      case 'Uploading': return 20;
      case 'Processing': return 40;
      case 'Performing Urdu OCR': return 60;
      case 'Creating embeddings': return 80;
      case 'Generating summary': return 95;
      default: return 10;
    }
  };

  return (
    <div className="p-margin-desktop space-y-12 max-w-7xl mx-auto w-full">

      {/* Guest Mode Top Banner */}
      {!user && (
        <div className="flex items-center justify-between gap-4 px-5 py-3.5 rounded-2xl bg-primary/8 border border-primary/20" style={{ background: 'linear-gradient(135deg, rgba(0,108,83,0.07) 0%, rgba(71,175,143,0.04) 100%)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>info</span>
            </div>
            <div>
              <p className="text-body-sm font-semibold text-on-surface">
                Guest Mode — <span className="text-primary">{guestUsed}/{guestLimit} PDFs uploaded</span>
              </p>
              <p className="text-[11px] text-on-surface-variant">Guest quota resets automatically on {guestResetLabel}.</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <a href="/login" className="px-4 py-1.5 text-[12px] font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors">
              Sign In
            </a>
            <a href="/register" className="px-4 py-1.5 text-[12px] font-bold text-on-primary bg-primary rounded-lg hover:opacity-90 active:scale-95 transition-all shadow-sm">
              Register Free
            </a>
          </div>
        </div>
      )}

      {/* Dashboard Hero */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">

        {/* Left Side: Upload Engine */}
        <div className="lg:col-span-8">
          {!processingFile ? (
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              className={`group cursor-pointer relative glass-card rounded-3xl p-16 flex flex-col items-center justify-center text-center transition-all duration-500 hover:border-primary/40 h-full min-h-[350px] ${dragActive ? 'drag-active' : ''
                }`}
              id="drop-zone"
              style={{ background: 'linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, var(--surface-container) 60%, transparent) 100%)' }}
            >
              <div className="absolute inset-0 border-2 border-dashed border-outline-variant/40 rounded-3xl group-hover:border-primary/50 transition-colors m-4"></div>

              <div className="relative z-10">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/20 shadow-xl shadow-primary/5 mx-auto">
                  <span className="material-symbols-outlined text-5xl">upload_file</span>
                </div>

                <h2 className="text-headline-md text-on-surface mb-3 tracking-tight">Upload Document</h2>
                <p className="text-body-md text-on-surface-variant max-w-sm mb-8 leading-relaxed mx-auto">
                  Drop your PDF here for cloud-powered AI indexing and quick dynamic summary analysis.
                </p>

                <button onClick={handleUploadClick} className="bg-primary-container text-white px-10 py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-95 transition-all flex items-center gap-2 mx-auto">
                  <span className="material-symbols-outlined text-xl">add_circle</span>
                  Select Document
                </button>
                <input type="file" onChange={handleFileChange} disabled={uploadedCount >= 5} accept="application/pdf" className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-3xl p-12 border border-primary/20 bg-primary/5 flex flex-col justify-center items-center text-center h-full min-h-[350px] shadow-xl relative overflow-hidden">
              <div className="absolute inset-0 border-2 border-solid border-primary/10 rounded-3xl m-4"></div>
              <div className="relative z-10 w-full max-w-md">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6 animate-spin mx-auto">
                  <span className="material-symbols-outlined text-3xl">sync</span>
                </div>
                <h3 className="text-headline-sm text-on-surface mb-2 font-bold truncate">{processingFile.name}</h3>
                <div className="flex items-center justify-center gap-2 text-primary font-mono text-xs uppercase tracking-widest font-bold mb-6 bg-primary/10 py-1.5 px-4 rounded-full w-max mx-auto border border-primary/20">
                  <span className="inline-block w-2 h-2 rounded-full bg-primary animate-ping"></span>
                  {processingStatus}
                </div>
                <div className="w-full h-3 bg-surface-container-highest rounded-full overflow-hidden mb-4 p-[2px] border border-outline-variant/20">
                  <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${getProgressPercentage(processingStatus)}%` }}></div>
                </div>
                <div className="text-left bg-surface-container-low/50 p-4 rounded-xl border border-outline-variant/20 space-y-2 text-xs font-medium text-on-surface-variant">
                  <div className={`flex items-center gap-2 ${processingStatus === 'Uploading' ? 'text-primary font-bold' : 'text-outline'}`}>
                    <span className="material-symbols-outlined text-sm">{getProgressPercentage(processingStatus) > 20 ? 'check_circle' : 'radio_button_checked'}</span>
                    <span>Uploading file to cloud workspace</span>
                  </div>
                  <div className={`flex items-center gap-2 ${processingStatus === 'Processing' ? 'text-primary font-bold' : 'text-outline'}`}>
                    <span className="material-symbols-outlined text-sm">{getProgressPercentage(processingStatus) > 40 ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span>Extracting structure & layouts</span>
                  </div>
                  <div className={`flex items-center gap-2 ${processingStatus === 'Performing Urdu OCR' ? 'text-primary font-bold' : 'text-outline'}`}>
                    <span className="material-symbols-outlined text-sm">{getProgressPercentage(processingStatus) > 60 ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span>Running Urdu OCR Engine (If Scanned)</span>
                  </div>
                  <div className={`flex items-center gap-2 ${processingStatus === 'Creating embeddings' ? 'text-primary font-bold' : 'text-outline'}`}>
                    <span className="material-symbols-outlined text-sm">{getProgressPercentage(processingStatus) > 80 ? 'check_circle' : 'radio_button_unchecked'}</span>
                    <span>Vectorizing content into analytics cluster</span>
                  </div>
                  <div className={`flex items-center gap-2 ${processingStatus === 'Generating summary' ? 'text-primary font-bold' : 'text-outline'}`}>
                    <span className="material-symbols-outlined text-sm">{processingStatus === 'Generating summary' ? 'hourglass_top' : 'radio_button_unchecked'}</span>
                    <span>Compiling context insights</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Replaced with Productivity Analytics Card */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <div className="glass-card rounded-3xl p-8 flex-1 flex flex-col justify-between shadow-pro relative overflow-hidden group">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  Analytics Platform
                </span>
                <span className="material-symbols-outlined text-primary text-xl">analytics</span>
              </div>
              <h3 className="text-title-sm text-on-surface mb-2 font-bold">Productivity Metrics</h3>
              <p className="text-body-sm text-on-surface-variant mb-6 leading-relaxed">
                Based on the actual page count processed across your PDFs.
              </p>
              <div className="grid grid-cols-2 gap-4 text-center bg-surface-container-low/40 p-3.5 rounded-2xl border border-outline-variant/10">
                <div className="border-r border-outline-variant/30 pr-2">
                  <span className="text-[10px] font-bold text-outline uppercase block">PDF Pages</span>
                  <span className="text-headline-sm font-bold text-on-surface mt-1 block">{estimatedPages}</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-outline uppercase block">Time Saved</span>
                  <span className="text-headline-sm font-bold text-primary mt-1 block">{hoursSaved}h</span>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center gap-2 text-[11px] font-medium text-on-surface-variant">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Web app cloud instances synced</span>
            </div>
          </div>

          {/* Guest PDF Limit Card - only shown to non-logged-in users */}
          {!user && (
            <div className="glass-card rounded-3xl p-8 shadow-pro relative overflow-hidden border border-primary/20">
              <div className="absolute -top-6 -right-6 w-24 h-24 bg-primary/10 rounded-full blur-2xl"></div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-outline uppercase tracking-widest">Guest Mode</span>
                <span className="material-symbols-outlined text-primary text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>person_off</span>
              </div>
              <div className="mb-3">
                <div className="flex items-end gap-1 mb-1">
                  <span className="text-display-lg text-on-surface font-bold">{guestUsed}</span>
                  <span className="text-on-surface-variant text-body-md mb-1.5">/{guestLimit}</span>
                </div>
                <span className="text-[11px] text-on-surface-variant font-semibold uppercase tracking-wider">Free PDFs Used</span>
              </div>
              <div className="w-full h-2.5 bg-surface-container-highest rounded-full overflow-hidden mb-4">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.min((guestUsed / guestLimit) * 100, 100)}%`,
                    background: guestUsed >= guestLimit ? 'var(--error)' : 'var(--primary)'
                  }}
                ></div>
              </div>
              {guestUsed >= guestLimit ? (
                <div className="mb-4 space-y-1.5">
                  <p className="text-body-sm text-error font-semibold flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px]">warning</span>
                    Limit reached!
                  </p>
                  <p className="text-[11px] text-on-surface-variant">Resets on {guestResetLabel}.</p>
                </div>
              ) : (
                <div className="mb-4 space-y-1.5">
                  <p className="text-body-sm text-on-surface-variant">
                    {guestRemaining} upload{guestRemaining !== 1 ? 's' : ''} remaining for guest
                  </p>
                  <p className="text-[11px] text-on-surface-variant">Resets on {guestResetLabel}.</p>
                </div>
              )}
              <a
                href="/register"
                className="block w-full py-2.5 bg-primary text-on-primary rounded-xl font-bold text-body-sm text-center hover:opacity-90 active:scale-95 transition-all shadow-md shadow-primary/20"
              >
                Sign Up for Unlimited
              </a>
            </div>
          )}
          <div className="glass-card rounded-3xl p-8 flex-1 shadow-pro">
            <div className="flex items-center justify-between mb-6">
              <span className="text-label-caps text-outline uppercase tracking-widest font-bold">Total Documents</span>
              <div className="p-2 bg-secondary-container/30 rounded-lg">
                <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface mb-1">{totalAnalyzed}</div>
            <div className="flex items-center gap-1.5 text-primary font-bold">
              <span className="material-symbols-outlined text-sm">cloud_done</span>
              <span className="text-body-sm">Cloud safe sync active</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Documents Section */}
      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <h3 className="text-headline-md text-on-surface tracking-tight">Recent Intelligence</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">Your secure cloud processed summaries</p>
          </div>
          <button onClick={() => navigate('/library')} className="text-primary font-bold text-body-sm flex items-center gap-1 hover:gap-2 transition-all">
            View Library <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-16 bg-surface-container rounded-3xl border border-outline-variant/30 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-outline-variant/60 mb-3">folder_open</span>
            <p className="text-body-md text-on-surface-variant font-medium">No documents processed yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {documents.slice(0, 3).map((doc) => (
              <div key={doc.id} onClick={() => onSelectDocument(doc.id)} className="glass-card rounded-3xl overflow-hidden hover:shadow-pro transition-all duration-300 group cursor-pointer flex flex-col justify-between">
                <div className="p-8 flex-grow flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-error-container/20 text-error flex items-center justify-center">
                        <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${doc.status === 'Ready for Chat' ? 'bg-secondary-container/40 text-on-secondary-container' : 'bg-surface-container-highest text-on-surface-variant animate-pulse'}`}>
                        {doc.status === 'Ready for Chat' ? 'Summarized' : doc.status}
                      </span>
                    </div>
                    <h4 className="text-title-sm text-on-surface mb-3 line-clamp-1 group-hover:text-primary transition-colors">{doc.fileName}</h4>
                    <p className="text-body-sm text-on-surface-variant line-clamp-3 mb-8 leading-relaxed">
                      {doc.status === 'Ready for Chat' ? doc.recentOverview || 'Summary ready for interactive prompt chat.' : 'Analyzing text vectors.'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-5 border-t border-outline-variant/30 mt-auto" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-2 text-outline">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      <span className="text-[12px] font-medium">{doc.uploadDate}</span>
                    </div>
                    <div className="flex gap-2">
                      <a href={`/api/export/${doc.id}/txt`} download className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-all"><span className="material-symbols-outlined text-lg">download</span></a>
                      <button onClick={(e) => handleDeleteDoc(e, doc.id)} className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-error transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Bento Section */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card rounded-3xl p-10 relative overflow-hidden group shadow-pro">
          <div className="relative z-10">
            <h3 className="text-title-sm mb-5">Data Integrity &amp; Security</h3>
            <p className="text-body-md text-on-surface-variant mb-8 leading-relaxed max-w-sm font-medium">
              Enterprise layer file handling pipelines with built-in database row security protocols. No unencrypted caching on public clouds.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-1.5 bg-surface-container-highest/60 border border-surface-container-highest/40 rounded-full text-[11px] font-bold text-on-surface-variant shadow-sm">Cloud Firewall</span>
              <span className="px-4 py-1.5 bg-surface-container-highest/60 border border-surface-container-highest/40 rounded-full text-[11px] font-bold text-on-surface-variant shadow-sm">Row Level Safety</span>
            </div>
          </div>
          <span className="material-symbols-outlined absolute -bottom-8 -right-8 text-[12rem] text-primary opacity-[0.03] transform -rotate-12">shield</span>
        </div>

        {/* Upgraded Prompt Helper Panel */}
        <div className="glass-card rounded-3xl p-10 flex flex-col justify-between shadow-pro relative overflow-hidden group border border-outline-variant/10">
          <div className="relative z-10 w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-title-sm text-primary flex items-center gap-2 font-bold">
                <span className="material-symbols-outlined text-xl">terminal</span>
                Interactive Prompt Guide
              </h3>
              <span className="font-mono text-[9px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded">PRO TIPS</span>
            </div>
            <p className="text-body-sm text-on-surface-variant leading-relaxed max-w-md font-medium mb-5">
              Open your target summarized document library item and perform these robust operational commands directly in chat:
            </p>
            <div className="space-y-2.5">
              <div className="flex items-start gap-2.5 bg-surface-container-low/50 p-2.5 rounded-xl border border-outline-variant/10 text-xs font-medium text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">ads_click</span>
                <span>"Compile an inventory list of dates, milestones, and deadlines mentioned across the document."</span>
              </div>
              <div className="flex items-start gap-2.5 bg-surface-container-low/50 p-2.5 rounded-xl border border-outline-variant/10 text-xs font-medium text-on-surface-variant">
                <span className="material-symbols-outlined text-primary text-sm mt-0.5">ads_click</span>
                <span>"Structure the layout's primary numerical data matrices into a clean clean summary chart markdown."</span>
              </div>
            </div>
          </div>
          <button onClick={() => navigate('/library')} className="mt-6 self-start bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold text-body-sm flex items-center gap-2 hover:opacity-95 transition-all shadow-sm relative z-10">
            <span className="material-symbols-outlined text-lg">folder_managed</span> Explore Library
          </button>
        </div>
      </section>
    </div>
  );
}