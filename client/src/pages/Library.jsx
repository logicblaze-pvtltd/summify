import React, { useState } from 'react';
import { useFeedback } from '../components/FeedbackProvider';

export default function Library({ documents, refreshDocuments, onSelectDocument }) {
  const { showAlert, showConfirm, showToast } = useFeedback();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocs, setSelectedDocs] = useState(new Set());
  const [viewType, setViewType] = useState('grid'); // 'grid' or 'list'
  const [sortBy, setSortBy] = useState('date'); // 'date', 'topic', 'size'

  // Filter and Search documents
  const filteredDocs = documents.filter(doc => {
    const query = searchQuery.toLowerCase();
    const titleMatch = doc.fileName.toLowerCase().includes(query);
    const tagMatch = doc.tags && doc.tags.some(t => t.toLowerCase().includes(query));
    return titleMatch || tagMatch;
  });

  // Sort documents
  const sortedDocs = [...filteredDocs].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.uploadDate) - new Date(a.uploadDate);
    }
    if (sortBy === 'size') {
      const sizeA = parseFloat(a.fileSize) || 0;
      const sizeB = parseFloat(b.fileSize) || 0;
      return sizeB - sizeA;
    }
    if (sortBy === 'topic') {
      const tagA = a.tags?.[0] || '';
      const tagB = b.tags?.[0] || '';
      return tagA.localeCompare(tagB);
    }
    return 0;
  });

  const toggleSelectCard = (e, docId) => {
    e.stopPropagation(); // Avoid triggering open document
    const newSelected = new Set(selectedDocs);
    if (newSelected.has(docId)) {
      newSelected.delete(docId);
    } else {
      newSelected.add(docId);
    }
    setSelectedDocs(newSelected);
  };

  const clearSelection = () => {
    setSelectedDocs(new Set());
  };

  const handleBatchDelete = async () => {
    if (selectedDocs.size === 0) {
      showToast({
        title: 'Nothing selected',
        message: 'Please select at least one document to delete.',
        tone: 'info'
      });
      return;
    }

    const confirmed = await showConfirm({
      title: 'Delete selected documents?',
      message: `Are you sure you want to permanently delete the ${selectedDocs.size} selected documents? This cannot be undone.`,
      tone: 'warning',
      confirmText: 'Delete Permanently',
      cancelText: 'Cancel'
    });

    if (!confirmed) return;

    try {
      const promises = Array.from(selectedDocs).map((id) =>
        fetch(`/api/documents/${id}`, { method: 'DELETE' })
      );
      const responses = await Promise.all(promises);
      if (!responses.every((response) => response.ok)) {
        throw new Error('One or more documents could not be deleted.');
      }
      const deletedCount = selectedDocs.size;
      setSelectedDocs(new Set());
      refreshDocuments();
      showToast({
        title: 'Documents deleted',
        message: `${deletedCount} document${deletedCount !== 1 ? 's' : ''} were permanently deleted.`,
        tone: 'success'
      });
    } catch (err) {
      console.error('Batch delete error:', err);
      void showAlert({
        title: 'Delete failed',
        message: err.message || 'Batch delete failed.',
        tone: 'danger',
        confirmText: 'Close'
      });
    }
  };

  const handleBatchExport = () => {
    // Basic bulk export handler (downloads summaries sequentially)
    Array.from(selectedDocs).forEach(id => {
      const doc = documents.find(d => d.id === id);
      if (doc) {
        const link = document.createElement('a');
        link.href = `/api/export/${id}/txt`;
        link.download = `${doc.fileName.replace('.pdf', '')}_summary.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    });
  };

  return (
    <div className="flex-grow flex flex-col min-w-0 bg-background h-screen">
      {/* Top Search bar */}
      <header className="h-16 w-full sticky top-0 z-30 bg-surface-container backdrop-blur-md border-b dark:border-gray-700 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center flex-1 max-w-2xl">
          <div className="relative w-full group">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline group-focus-within:text-primary transition-colors">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-surface-container-high border border-gray-700 border-gray-300 rounded-lg text-body-md focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline/60"
              placeholder="Search within document summaries..."
            />
          </div>
        </div>
      </header>

      {/* Scrollable Content */}
      <div className="flex-grow overflow-y-auto p-6 md:p-8 custom-scrollbar">
        
        {/* Header and Filter Options */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
          <div>
            <h2 className="text-display-lg font-bold text-on-surface">My Library</h2>
            <p className="text-body-md text-tertiary mt-1">Manage and organize your locally processed intelligence.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex gap-2 items-center bg-surface-container-highest border border-outline-variant rounded-lg p-1">
              <button
                onClick={() => setSortBy('date')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm transition-all ${
                  sortBy === 'date' ? 'bg-surface-container-high text-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">calendar_today</span>
                <span>Date</span>
              </button>
              
              <button
                onClick={() => setSortBy('topic')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm transition-all ${
                  sortBy === 'topic' ? 'bg-surface-container-high text-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                <span>Topic</span>
              </button>
              
              <button
                onClick={() => setSortBy('size')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-body-sm transition-all ${
                  sortBy === 'size' ? 'bg-surface-container-high text-primary font-bold shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                <span className="material-symbols-outlined text-[18px]">straighten</span>
                <span>Size</span>
              </button>
            </div>

            <div className="h-8 w-[1px] bg-outline-variant mx-1"></div>
            
            <div className="flex items-center bg-surface-container-highest border border-outline-variant rounded-lg p-1">
              <button
                onClick={() => setViewType('grid')}
                className={`p-1.5 rounded-md transition-all ${viewType === 'grid' ? 'text-primary bg-surface-container-high shadow-sm' : 'text-outline hover:text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined">grid_view</span>
              </button>
              <button
                onClick={() => setViewType('list')}
                className={`p-1.5 rounded-md transition-all ${viewType === 'list' ? 'text-primary bg-surface-container-high shadow-sm' : 'text-outline hover:text-on-surface-variant'}`}
              >
                <span className="material-symbols-outlined">view_list</span>
              </button>
            </div>
          </div>
        </div>

        {/* Selection Toolbar (Shown when items are selected) */}
        {selectedDocs.size > 0 && (
          <div className="flex items-center justify-between bg-surface-container bg-surface-container-highest text-on-surface px-6 py-3 rounded-xl mb-6 shadow-lg animate-in fade-in slide-in-from-top-4 duration-300">
            <div className="flex items-center gap-4">
              <span className="font-bold text-body-md">{selectedDocs.size} items selected</span>
              <div className="h-4 w-[1px] bg-on-surface/20"></div>
              <button
                onClick={handleBatchExport}
                className="flex items-center gap-1.5 text-body-sm hover:text-emerald-300 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">ios_share</span>
                Export Summaries
              </button>
            </div>
            
            <div className="flex items-center gap-3">
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-1.5 text-body-sm text-red-500 dark:text-red-300 dark:hover:text-white hover:text-red-400 transition-colors"
              >
                <span className="material-symbols-outlined text-[20px]">delete</span>
                Delete Permanent
              </button>
              <button onClick={clearSelection} className="p-1 hover:bg-on-surface/10 rounded-full transition-colors">
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
          </div>
        )}

        {sortedDocs.length === 0 ? (
          <div className="text-center py-20 bg-surface-container rounded-2xl border border-outline-variant/30">
            <span className="material-symbols-outlined text-6xl text-outline-variant/60 mb-4">search_off</span>
            <p className="text-body-md text-on-surface-variant font-medium">No matching documents found</p>
            <p className="text-body-sm text-outline mt-1">Try refining your search terms or upload a new PDF.</p>
          </div>
        ) : (
          /* Bento Grid / List */
          <div className={viewType === 'grid' 
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-6" 
            : "space-y-4"
          }>
            {sortedDocs.map((doc) => {
              const isSelected = selectedDocs.has(doc.id);
              
              if (viewType === 'grid') {
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc.id)}
                    className={`group relative glass-card border rounded-xl p-4 transition-all duration-300 cursor-pointer hover:shadow-pro hover:-translate-y-1 ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-outline-variant'
                    }`}
                  >
                    {/* Select Checkbox on hover */}
                    <div
                      onClick={(e) => toggleSelectCard(e, doc.id)}
                      className={`absolute top-3 right-3 z-10 w-6 h-6 rounded-full border-2 bg-surface-container-highest flex items-center justify-center shadow-sm transition-opacity duration-200 ${
                        isSelected 
                          ? 'border-primary bg-primary text-[#3DBB96] dark:text-white' 
                          : 'border-outline-variant opacity-0 group-hover:opacity-100 hover:border-primary'
                      }`}
                    >
                      <span className={`material-symbols-outlined text-[16px] transition-transform ${isSelected ? 'scale-100' : 'scale-0'}`}>
                        check
                      </span>
                    </div>

                    {/* Mock thumbnail / PDF preview */}
                    <div className="aspect-[3/2] w-full bg-surface-container-highest rounded-lg mb-4 flex items-center justify-center overflow-hidden border border-gray-400/40 dark:border-gray-700 relative">
                      <div className="flex flex-col items-center justify-center h-full w-full bg-surface-container-highest">
                        <span className="material-symbols-outlined text-outline-variant text-[52px] group-hover:scale-110 transition-transform duration-300">
                          picture_as_pdf
                        </span>
                        <span className="text-[10px] text-outline mt-1 font-mono uppercase tracking-wider">
                          {doc.pageCount} Pages
                        </span>
                      </div>
                    </div>

                    {/* Metadata details */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0">
                        <h3 className="font-bold text-on-surface text-body-md truncate group-hover:text-primary transition-colors">
                          {doc.fileName}
                        </h3>
                        <p className="text-[11px] text-outline mt-0.5 uppercase tracking-wider font-semibold">
                          {doc.fileSize} • {doc.uploadDate}
                        </p>
                      </div>
                      <span className={`shrink-0 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        doc.status === 'Ready for Chat'
                          ? 'bg-primary/10 text-primary border-gray-400/50'
                          : 'bg-outline-variant/20 text-outline border-transparent'
                      }`}>
                        {doc.status === 'Ready for Chat' ? 'Summarized' : doc.status}
                      </span>
                    </div>

                    {/* Tags */}
                    {doc.tags && doc.tags.length > 0 && (
                      <div className="pt-3 border-t border-gray-400/40 dark:border-gray-700 flex flex-wrap gap-1.5">
                        {doc.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[11px] font-medium hover:bg-surface-container-high transition-colors"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              } else {
                /* List View Item */
                return (
                  <div
                    key={doc.id}
                    onClick={() => onSelectDocument(doc.id)}
                    className={`group flex items-center justify-between bg-surface-container-highest border p-4 rounded-xl cursor-pointer hover:shadow-pro transition-all ${
                      isSelected ? 'border-primary bg-primary/5' : 'border-outline-variant'
                    }`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div
                        onClick={(e) => toggleSelectCard(e, doc.id)}
                        className={`w-6 h-6 rounded-full border-2 bg-surface-container-highest flex items-center justify-center shrink-0 shadow-sm ${
                          isSelected ? 'border-primary bg-primary text-white' : 'border-outline-variant group-hover:border-primary'
                        }`}
                      >
                        <span className={`material-symbols-outlined text-[16px] ${isSelected ? 'scale-100' : 'scale-0'}`}>
                          check
                        </span>
                      </div>
                      
                      <span className="material-symbols-outlined text-error text-3xl">picture_as_pdf</span>
                      
                      <div className="min-w-0">
                        <h3 className="font-bold text-on-surface text-body-md truncate group-hover:text-primary transition-colors">
                          {doc.fileName}
                        </h3>
                        <p className="text-[11px] text-outline mt-0.5 uppercase tracking-wider font-semibold">
                          {doc.fileSize} • {doc.uploadDate} • {doc.pageCount} Pages
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4" onClick={e => e.stopPropagation()}>
                      {doc.tags && doc.tags.length > 0 && (
                        <div className="hidden md:flex gap-1.5">
                          {doc.tags.map((tag, idx) => (
                            <span key={idx} className="px-2 py-0.5 rounded bg-surface-container text-on-surface-variant text-[11px] font-medium">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                        doc.status === 'Ready for Chat' ? 'bg-primary/10 text-primary border-gray-600/50' : 'bg-outline-variant/20 text-outline border-transparent'
                      }`}>
                        {doc.status === 'Ready for Chat' ? 'Summarized' : doc.status}
                      </span>
                      
                      <a
                        href={`/api/export/${doc.id}/txt`}
                        download
                        className="p-2 text-outline hover:text-primary rounded-lg transition-colors"
                        title="Download Summary"
                      >
                        <span className="material-symbols-outlined text-lg">download</span>
                      </a>
                    </div>
                  </div>
                );
              }
            })}
          </div>
        )}
      </div>
    </div>
  );
}
