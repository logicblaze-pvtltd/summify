import React, { useState, useEffect } from 'react';

export default function Dashboard({ onSelectDocument, onViewChange, documents, refreshDocuments }) {
  const [dragActive, setDragActive] = useState(false);
  const [processingFile, setProcessingFile] = useState(null);
  const [processingStatus, setProcessingStatus] = useState('');

  // Stats calculations based on actual documents
  const totalAnalyzed = documents.length;
  const utilizedCache = (documents.reduce((acc, doc) => {
    const size = parseFloat(doc.fileSize) || 0;
    return acc + size;
  }, 0)).toFixed(1);
  const cachePercentage = Math.min(Math.round((utilizedCache / 10) * 100), 100);

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
              alert('Error processing PDF: ' + (doc.text || 'Unknown error'));
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

  // Handle drag and drop states
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
    if (file.type !== 'application/pdf') {
      alert('Only PDF files are allowed.');
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      alert('File size exceeds the 50 MB limit.');
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
        throw new Error('Upload failed');
      }

      const data = await response.json();
      setProcessingFile({ name: file.name, id: data.id });
      setProcessingStatus(data.status);
    } catch (err) {
      console.error('Upload error:', err);
      alert('Failed to upload file. Make sure the backend server is running.');
      setProcessingFile(null);
      setProcessingStatus('');
    }
  };

  const handleDeleteDoc = async (e, id) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        const res = await fetch(`/api/documents/${id}`, { method: 'DELETE' });
        if (res.ok) {
          refreshDocuments();
        }
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  const getProgressPercentage = (status) => {
    switch (status) {
      case 'Uploading': return 25;
      case 'Processing': return 50;
      case 'Creating embeddings': return 75;
      case 'Generating summary': return 90;
      default: return 10;
    }
  };

  return (
    <div className="p-margin-desktop space-y-12 max-w-7xl mx-auto w-full">
      {/* Dashboard Hero: Upload & Stats */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Drag and Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          className={`lg:col-span-8 group cursor-pointer relative glass-card rounded-3xl p-16 flex flex-col items-center justify-center text-center transition-all duration-500 hover:border-primary/40 ${
            dragActive ? 'drag-active' : ''
          }`}
          id="drop-zone"
          style={{ background: 'linear-gradient(135deg, var(--glass-bg) 0%, color-mix(in srgb, var(--surface-container) 60%, transparent) 100%)' }}
        >
          <div className="absolute inset-0 border-2 border-dashed border-outline-variant/40 rounded-3xl group-hover:border-primary/50 transition-colors m-4"></div>
          
          <div className="relative z-10">
            <div className="w-20 h-20 rounded-3xl bg-primary/10 text-primary flex items-center justify-center mb-6 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary/20 shadow-xl shadow-primary/5 mx-auto">
              <span className="material-symbols-outlined text-5xl">upload_file</span>
            </div>
            
            <h2 className="text-headline-md text-on-surface mb-3 tracking-tight">Drop your PDF here</h2>
            
            <p className="text-body-md text-on-surface-variant max-w-sm mb-8 leading-relaxed mx-auto">
              Processing is 100% local. Your intelligence never leaves the edge.
            </p>
            
            <button className="bg-primary-container text-white px-10 py-3.5 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-95 transition-all flex items-center gap-2 mx-auto">
              <span className="material-symbols-outlined text-xl">add_circle</span>
              Select Document
            </button>
            
            {/* Native file input overlay matching user's design */}
            <input
              type="file"
              onChange={handleFileChange}
              accept="application/pdf"
              className="absolute inset-0 opacity-0 cursor-pointer"
            />
          </div>
        </div>

        {/* Stats Widget */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          {/* Active Processing Loader */}
          {processingFile && (
            <div className="glass-card rounded-3xl p-8 shadow-pro border border-primary-container/20 bg-primary-container/5 animate-pulse flex-1">
              <div className="flex items-center gap-3 mb-6">
                <span className="material-symbols-outlined text-primary animate-spin">sync</span>
                <div className="min-w-0">
                  <h4 className="font-bold text-body-sm truncate">{processingFile.name}</h4>
                  <p className="text-[10px] text-outline uppercase tracking-wider font-bold">{processingStatus}</p>
                </div>
              </div>
              <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-primary transition-all duration-500"
                  style={{ width: `${getProgressPercentage(processingStatus)}%` }}
                ></div>
              </div>
              <p className="text-body-sm font-medium text-on-surface-variant">Analyzing PDF data...</p>
            </div>
          )}

          {!processingFile && (
            <div className="glass-card rounded-3xl p-8 flex-1 flex flex-col shadow-pro">
              <div className="flex items-center justify-between mb-6">
                <span className="text-label-caps text-outline uppercase tracking-widest font-bold">Local Engine</span>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <span className="material-symbols-outlined text-primary text-xl">database</span>
                </div>
              </div>
              <div className="text-display-lg text-on-surface mb-2">
                {utilizedCache} <span className="text-body-md font-medium text-on-surface-variant">MB</span>
              </div>
              <div className="mt-auto">
                <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden mb-3">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${cachePercentage}%` }}></div>
                </div>
                <p className="text-body-sm font-medium text-on-surface-variant">{cachePercentage}% of local cache utilized</p>
              </div>
            </div>
          )}

          <div className="glass-card rounded-3xl p-8 flex-1 shadow-pro">
            <div className="flex items-center justify-between mb-6">
              <span className="text-label-caps text-outline uppercase tracking-widest font-bold">Total Analyzed</span>
              <div className="p-2 bg-secondary-container/30 rounded-lg">
                <span className="material-symbols-outlined text-primary text-xl">auto_awesome</span>
              </div>
            </div>
            <div className="text-display-lg text-on-surface mb-1">{totalAnalyzed}</div>
            <div className="flex items-center gap-1.5 text-primary font-bold">
              <span className="material-symbols-outlined text-sm">trending_up</span>
              <span className="text-body-sm">Secure local storage active</span>
            </div>
          </div>
        </div>
      </section>

      {/* Recent Documents Section */}
      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <h3 className="text-headline-md text-on-surface tracking-tight">Recent Intelligence</h3>
            <p className="text-body-sm text-on-surface-variant mt-1">Your locally processed summaries</p>
          </div>
          <button
            onClick={() => onViewChange('library')}
            className="text-primary font-bold text-body-sm flex items-center gap-1 hover:gap-2 transition-all"
          >
            View Library
            <span className="material-symbols-outlined text-sm">arrow_forward</span>
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="text-center py-16 bg-surface-container rounded-3xl border border-outline-variant/30 shadow-sm">
            <span className="material-symbols-outlined text-5xl text-outline-variant/60 mb-3">folder_open</span>
            <p className="text-body-md text-on-surface-variant font-medium">No documents processed yet</p>
            <p className="text-body-sm text-outline mt-1">Drag and drop a PDF file above to analyze.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
            {documents.slice(0, 3).map((doc) => (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className="glass-card rounded-3xl overflow-hidden hover:shadow-pro transition-all duration-300 group cursor-pointer shadow-pro flex flex-col justify-between"
              >
                <div className="p-8 flex-grow flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-6">
                      <div className="w-12 h-12 rounded-2xl bg-error-container/20 text-error flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-2xl">picture_as_pdf</span>
                      </div>
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-widest ${
                        doc.status === 'Ready for Chat' 
                          ? 'bg-secondary-container/40 text-on-secondary-container'
                          : doc.status === 'Error'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-surface-container-highest text-on-surface-variant animate-pulse'
                      }`}>
                        {doc.status === 'Ready for Chat' ? 'Summarized' : doc.status}
                      </span>
                    </div>

                    <h4 className="text-title-sm text-on-surface mb-3 line-clamp-1 group-hover:text-primary transition-colors">
                      {doc.fileName}
                    </h4>
                    
                    <p className="text-body-sm text-on-surface-variant line-clamp-3 mb-8 leading-relaxed">
                      {doc.status === 'Ready for Chat' 
                        ? doc.recentOverview || 'Summary generated and ready for exploration.' 
                        : doc.status === 'Error'
                        ? 'Failed to process document.'
                        : 'Document is currently being analyzed by the local processor.'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-5 border-t border-outline-variant/30 mt-auto">
                    <div className="flex items-center gap-2 text-outline">
                      <span className="material-symbols-outlined text-sm">calendar_today</span>
                      <span className="text-[12px] font-medium">{doc.uploadDate}</span>
                    </div>
                    <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                      <a
                        href={`/api/export/${doc.id}/txt`}
                        download
                        className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-primary transition-all"
                        title="Download Summary"
                      >
                        <span className="material-symbols-outlined text-lg">download</span>
                      </a>
                      <button
                        onClick={(e) => handleDeleteDoc(e, doc.id)}
                        className="p-2 rounded-xl hover:bg-surface-container text-outline hover:text-error transition-all"
                        title="Delete Document"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick Actions Bento Grid */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="glass-card rounded-3xl p-10 relative overflow-hidden group shadow-pro">
          <div className="relative z-10">
            <h3 className="text-title-sm mb-5">Privacy &amp; Security</h3>
            <p className="text-body-md text-on-surface-variant mb-8 leading-relaxed max-w-sm font-medium">
              Enterprise-grade document processing using local hardware acceleration. No telemetry, no cloud, no compromise.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="px-4 py-1.5 bg-surface-container-highest/60 border border-surface-container-highest/40 rounded-full text-[11px] font-bold text-on-surface-variant shadow-sm">
                AES-256
              </span>
              <span className="px-4 py-1.5 bg-surface-container-highest/60 border border-surface-container-highest/40 rounded-full text-[11px] font-bold text-on-surface-variant shadow-sm">
                Local Neural Engine
              </span>
              <span className="px-4 py-1.5 bg-surface-container-highest/60 border border-surface-container-highest/40 rounded-full text-[11px] font-bold text-on-surface-variant shadow-sm">
                Zero-Trust Architecture
              </span>
            </div>
          </div>
          <span className="material-symbols-outlined absolute -bottom-8 -right-8 text-[12rem] text-primary opacity-[0.03] transform -rotate-12 group-hover:scale-110 transition-transform duration-700">
            shield
          </span>
        </div>

        <div className="bg-primary-container/5 border border-primary-container/10 rounded-3xl p-10 flex flex-col justify-between shadow-pro relative overflow-hidden group">
          <div className="relative z-10">
            <h3 className="text-title-sm text-primary mb-3">AI Model Configurations</h3>
            <p className="text-body-md text-on-surface-variant leading-relaxed max-w-sm font-medium">
              Specify your Google Gemini API Key in Settings to enable high-speed AI summarization and chat capabilities.
            </p>
          </div>
          <button
            onClick={() => onViewChange('settings')}
            className="mt-8 self-start bg-primary-container text-white px-6 py-3 rounded-2xl font-bold text-body-sm flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary-container/20 relative z-10"
          >
            <span className="material-symbols-outlined text-lg">settings</span>
            Configure AI Engine
          </button>
          <span className="material-symbols-outlined absolute -top-8 -right-8 text-[12rem] text-primary-container opacity-[0.05] transform rotate-12 group-hover:scale-105 transition-transform duration-700">
            bolt
          </span>
        </div>
      </section>
    </div>
  );
}
