import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFeedback } from '../components/FeedbackProvider';

export default function Chat({ documents, refreshDocuments, onNewSummary, user }) {
  const { showAlert, showConfirm, showToast } = useFeedback();
  const { docId } = useParams();
  const [activeLeftTab, setActiveLeftTab] = useState('summary');
  const [activeSummaryType, setActiveSummaryType] = useState('short');
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(100);
  const [documentPage, setDocumentPage] = useState(1);
  const messagesEndRef = useRef(null);

  // --- URDU DETECTION LOGIC ---
  // Ye function check karta hai ke text mein Urdu ke huroof hain ya nahi
  const containsUrdu = (text) => {
    if (!text) return false;
    // Urdu/Arabic Unicode range
    return /[\u0600-\u06FF\u0750-\u077F]/.test(text);
  };
  // ----------------------------

  const docMeta = documents.find(d => d.id === docId);
  const [fullDoc, setFullDoc] = useState(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    let isMounted = true;
    if (docId) {
      setLoadingDoc(true);
      const fetchFullDoc = async () => {
        try {
          const res = await fetch(`/api/documents/${docId}`);
          if (res.ok && isMounted) {
            const data = await res.json();
            setFullDoc(data);
          }
        } catch (err) {
          console.error('Error fetching full document details:', err);
        } finally {
          if (isMounted) setLoadingDoc(false);
        }
      };
      fetchFullDoc();
    } else {
      setFullDoc(null);
    }
    return () => { isMounted = false; };
  }, [docId, docMeta?.status]);

  const doc = fullDoc;

  useEffect(() => {
    if (doc) {
      const welcomeMessage = {
        id: 'welcome',
        sender: 'ai',
        text: `Hello! I've analyzed **${doc.fileName}**. I'm ready to answer any questions about this document. What would you like to explore?`,
        suggestions: ['What is the main purpose of this document?', 'Summarize key takeaways', 'List important dates', 'Who are the stakeholders?']
      };

      const history = doc.chatHistory || [];
      const historyMessages = [];
      history.forEach((turn, idx) => {
        historyMessages.push({ id: `q-${idx}`, sender: 'user', text: turn.question });
        historyMessages.push({ id: `a-${idx}`, sender: 'ai', text: turn.answer });
      });

      setMessages([welcomeMessage, ...historyMessages]);
    }
  }, [docId, !!doc]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ... (Baaki functions handleSend, handleClearChat wagera wese hi rahengy)
  
  const handleSend = async (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim() || loading) return;

    const userMsgId = 'user-' + Date.now();
    const newUserMessage = { id: userMsgId, sender: 'user', text: query };
    setMessages(prev => [...prev, newUserMessage]);

    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      const response = await fetch(`/api/chat/${docId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query })
      });

      if (!response.ok) throw new Error('Chat request failed');

      const data = await response.json();
      const aiMsgId = 'ai-' + Date.now();
      setMessages(prev => [...prev, { id: aiMsgId, sender: 'ai', text: data.answer }]);
      refreshDocuments();
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, {
        id: 'err-' + Date.now(),
        sender: 'ai',
        text: 'Sorry, I encountered an error communicating with the AI. Please verify the backend configuration or re-attempt.'
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = async () => {
    const confirmed = await showConfirm({
      title: 'Clear chat history?',
      message: 'Clear entire chat history for this document? This will remove the conversation from the current document.',
      tone: 'warning',
      confirmText: 'Clear Chat',
      cancelText: 'Cancel'
    });

    if (confirmed) {
      try {
        const res = await fetch(`/api/chat/${docId}/clear`, { method: 'POST' });
        if (res.ok) {
          setMessages([messages[0]]);
          refreshDocuments();
          showToast({
            title: 'Chat cleared',
            message: 'The conversation was removed from this document.',
            tone: 'success'
          });
        } else {
          void showAlert({
            title: 'Clear failed',
            message: 'Could not clear the chat history right now.',
            tone: 'danger',
            confirmText: 'Close'
          });
        }
      } catch (err) { console.error('Clear chat error:', err);
        void showAlert({
          title: 'Clear failed',
          message: err.message || 'Could not clear the chat history right now.',
          tone: 'danger',
          confirmText: 'Close'
        });
      }
    }
  };

  const downloadChat = () => {
    const chatContent = messages.map(m => `${m.sender.toUpperCase()}: ${m.text}`).join('\n\n');
    const blob = new Blob([chatContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${doc.fileName.replace('.pdf', '')}_chat_history.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMarkdown = (text) => {
    if (!text) return '';
    let html = text
      .replace(/### (.*)/g, '<h3 class="text-title-sm font-bold text-on-surface mt-4 mb-2">$1</h3>')
      .replace(/## (.*)/g, '<h2 class="text-body-md font-bold text-primary mt-5 mb-2">$1</h2>')
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-on-surface">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      .replace(/• (.*)/g, '<li class="ml-4 list-disc pl-1 py-0.5">$1</li>')
      .replace(/- (.*)/g, '<li class="ml-4 list-disc pl-1 py-0.5">$1</li>')
      .replace(/\n\n/g, `</p><p class="${`text-on-surface-variant leading-relaxed mb-3 ${containsUrdu(doc.summaries[activeSummaryType]) ? 'urdu-calligraphy text-xl' : 'text-body-sm'}`}">`)
      .replace(/\n/g, '<br/>');

    return `<p class="${`text-on-surface-variant leading-relaxed mb-3 ${containsUrdu(doc.summaries[activeSummaryType]) ? 'urdu-calligraphy text-xl' : 'text-body-sm'}`}">${html}</p>`;
  };

  const getPagesText = () => {
    if (!doc || !doc.text) return ["This document has no readable text content."];
    const pages = doc.text.split('\f');
    if (pages.length <= 1) {
      const paragraphs = doc.text.split('\n\n').filter(p => p.trim().length > 0);
      const itemsPerPage = 3;
      const chunks = [];
      for (let i = 0; i < paragraphs.length; i += itemsPerPage) {
        chunks.push(paragraphs.slice(i, i + itemsPerPage).join('\n\n'));
      }
      return chunks.length > 0 ? chunks : [doc.text];
    }
    return pages;
  };

  const pagesArray = doc ? getPagesText() : [];
  const activePageText = doc ? (pagesArray[Math.min(documentPage - 1, pagesArray.length - 1)] || '') : '';

  if (docId && (!doc || loadingDoc)) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-background h-screen">
        <span className="material-symbols-outlined text-4xl text-outline animate-spin mb-3">sync</span>
        <p className="text-body-md font-bold text-on-surface">Loading document intelligence...</p>
      </div>
    );
  }

  if (!docId) {
    return (
      <div className="flex-grow flex flex-col items-center justify-center p-8 text-center bg-background h-screen">
        <span className="material-symbols-outlined text-6xl text-outline mb-4">description</span>
        <h3 className="text-title-sm font-bold text-on-surface">No document loaded</h3>
        <p className="text-body-sm text-outline mt-1 mb-6">Select a document from your library or upload a new one to begin.</p>
        <button onClick={onNewSummary} className="bg-primary text-on-primary px-6 py-2.5 rounded-xl font-bold active:scale-95 transition-all">
          Upload PDF
        </button>
      </div>
    );
  }

  return (
    <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
      {/* Top Header */}
      <header className="h-16 w-full bg-surface-container border-b border-outline-variant flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2 text-primary font-bold min-w-0">
            <span className="material-symbols-outlined shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>description</span>
            <span className="text-body-md font-bold truncate max-w-[240px] md:max-w-[400px]">{doc.fileName}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
           {/* ... (Export buttons code wese hi rahega) ... */}
        </div>
      </header>

      {/* Content Canvas */}
      <section className="flex-1 flex overflow-hidden p-4 gap-4 bg-background min-h-0">
        
        {/* Left Pane */}
        <div className="glass-card flex-[1.4] flex flex-col bg-surface-container-highest rounded-xl border border-outline-variant/30 overflow-hidden shadow-xl min-w-0 relative h-full">
          <div className="absolute top-0 left-0 right-0 h-11 z-30 backdrop-blur-xl backdrop-saturate-125 bg-surface-container-low/60 border-b border-gray-400/20 dark:border-gray-700/50 px-3 flex items-center justify-between shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
            <div className="flex h-full">
              <button onClick={() => setActiveLeftTab('summary')} className={`h-full px-5 text-body-sm font-bold border-b-2 flex items-center justify-center transition-all duration-150 ${activeLeftTab === 'summary' ? 'border-primary text-primary' : 'border-transparent text-outline hover:text-on-surface-variant'}`}>
                Summary Report
              </button>
              <button onClick={() => setActiveLeftTab('document')} className={`h-full px-5 text-body-sm font-bold border-b-2 flex items-center justify-center transition-all duration-150 ${activeLeftTab === 'document' ? 'border-primary text-primary' : 'border-transparent text-outline hover:text-on-surface-variant'}`}>
                Document Text
              </button>
            </div>
          </div>

          {activeLeftTab === 'summary' ? (
            <div className="flex-grow flex flex-col h-full w-full relative">
              <div className="absolute top-11 left-0 right-0 h-11 z-25 backdrop-blur-lg backdrop-saturate-125 bg-surface-container-lowest/65 border-b border-outline-variant/10 p-1.5 flex gap-1 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                {['short', 'detailed', 'bullet', 'executive'].map((type) => (
                  <button key={type} onClick={() => setActiveSummaryType(type)} className={`flex-1 py-1.5 px-3 rounded-lg text-[11px] font-bold uppercase tracking-wider text-center transition-all duration-150 ${activeSummaryType === type ? 'bg-surface-container dark:text-white shadow-sm' : 'text-on-surface-variant hover:bg-surface-container/50'}`}>
                    {type}
                  </button>
                ))}
              </div>

              <div className="flex-grow overflow-y-auto pt-[88px] p-8 custom-scrollbar h-full">
                {doc.status !== 'Ready for Chat' ? (
                  <div className="flex flex-col items-center justify-center h-full text-center mt-10">
                    <span className="material-symbols-outlined text-4xl text-outline animate-spin mb-3">sync</span>
                    <p className={`font-bold text-on-surface ${containsUrdu(doc.summaries[activeSummaryType]) ? 'urdu-calligraphy text-2xl' : 'text-body-md'}`}>Summarizing Document...</p>
                  </div>
                ) : (
                  // Summary Report ke liye conditional check
                  <div
                    className={`prose max-w-none prose-sm bg-white dark:bg-gray-800 bg-surface-container shadow-pro p-6 space-y-4 border border-outline-variant/20 dark:border-gray-700 rounded ${containsUrdu(doc.summaries[activeSummaryType]) ? 'urdu-calligraphy' : ''}`}
                    dangerouslySetInnerHTML={{ __html: renderMarkdown(doc.summaries[activeSummaryType]) }}
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="flex-grow flex flex-col h-full w-full relative">
              <div className="absolute top-11 left-0 right-0 h-10 z-25 backdrop-blur-lg backdrop-saturate-125 bg-surface-container-highest/60 border-b border-gray-400/20 dark:border-gray-700/50 flex items-center justify-between px-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.03)]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-0.5 text-on-surface-variant">
                    <button onClick={() => setDocumentPage(prev => Math.max(1, prev - 1))} disabled={documentPage <= 1} className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-40">
                      <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                    </button>
                    <span className="text-[11px] font-semibold px-2 min-w-[80px] text-center">{documentPage} / {pagesArray.length}</span>
                    <button onClick={() => setDocumentPage(prev => Math.min(pagesArray.length, prev + 1))} disabled={documentPage >= pagesArray.length} className="p-1 hover:bg-white/5 rounded transition-colors disabled:opacity-40">
                      <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                    </button>
                  </div>
                  <div className="w-px h-3 bg-outline-variant/30"></div>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))} className="p-1 hover:bg-white/5 rounded transition-colors">
                      <span className="material-symbols-outlined text-[18px]">zoom_out</span>
                    </button>
                    <span className="text-[11px] font-semibold px-1">{zoomLevel}%</span>
                    <button onClick={() => setZoomLevel(prev => Math.min(200, prev + 10))} className="p-1 hover:bg-white/5 rounded transition-colors">
                      <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex-grow overflow-auto bg-surface-container-low/20 pt-[84px] p-6 h-full">
                <div
                  className="bg-white dark:bg-gray-800 w-full max-w-[800px] bg-surface-container shadow-pro min-h-[700px] p-10 space-y-4 border border-outline-variant/20 dark:border-gray-700 rounded mx-auto"
                  style={{ zoom: zoomLevel / 100 }}
                >
                  <div className="flex items-center justify-between border-b border-gray-400/20 dark:border-gray-700 pb-2 mb-4">
                    <span className="text-[10px] text-outline font-mono uppercase">Page {documentPage} text extraction</span>
                    <span className="text-[10px] text-outline font-mono uppercase">{doc.fileName.substring(0, 30)}</span>
                  </div>
                  {/* Document Text Pane ke liye conditional check */}
                  <p className={`text-body-sm text-on-surface-variant whitespace-pre-wrap leading-relaxed break-words ${containsUrdu(activePageText) ? 'urdu-calligraphy' : ''}`}>
                    {activePageText}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Pane: AI Chat */}
        <div className="flex-1 flex flex-col bg-surface-container-highest rounded-xl border border-gray-400/20 dark:border-gray-800 overflow-hidden shadow-xl min-w-0 relative glass-gradient-panel">
          {/* Guest Lock Overlay - shown if not logged in */}
          {!user && (
            <div className="absolute inset-0 z-50 flex flex-col items-center justify-center p-8 text-center" style={{ background: 'linear-gradient(135deg, rgba(0,108,83,0.06) 0%, rgba(71,175,143,0.04) 100%)', backdropFilter: 'blur(2px)' }}>
              <div className="relative mb-6">
                <div className="w-20 h-20 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg">
                  <span className="material-symbols-outlined text-primary text-[40px]" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
                </div>
                <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center shadow-md">
                  <span className="material-symbols-outlined text-on-primary text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                </div>
              </div>
              <h3 className="text-title-sm font-bold text-on-surface mb-2">AI Chat Restricted</h3>
              <p className="text-body-sm text-on-surface-variant mb-1 max-w-[220px]">Sign in to unlock the AI document assistant and chat with your PDFs.</p>
              <div className="flex items-center gap-2 mt-2 mb-6">
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary-container/30 rounded-full border border-secondary/30">
                  <span className="material-symbols-outlined text-secondary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-[11px] font-semibold text-secondary">Unlimited Chat</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-container/20 rounded-full border border-primary/20">
                  <span className="material-symbols-outlined text-primary text-[13px]" style={{ fontVariationSettings: "'FILL' 1" }}>all_inclusive</span>
                  <span className="text-[11px] font-semibold text-primary">Unlimited PDFs</span>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-[220px]">
                <Link
                  to="/register"
                  className="w-full py-3 bg-primary text-on-primary rounded-xl font-bold text-body-sm text-center hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-primary/20"
                >
                  Create Free Account
                </Link>
                <Link
                  to="/login"
                  className="w-full py-3 bg-surface-container border border-outline-variant text-on-surface rounded-xl font-semibold text-body-sm text-center hover:bg-surface-container-high active:scale-95 transition-all"
                >
                  Sign In
                </Link>
              </div>
              <p className="text-[10px] text-outline mt-5 flex items-center gap-1">
                <span className="material-symbols-outlined text-[12px]">verified_user</span>
                Free to join · No credit card needed
              </p>
            </div>
          )}
          <div className="flex-grow overflow-y-auto scrollbar-hide flex flex-col relative">
            <div className="sticky top-0 z-10 backdrop-blur-xl backdrop-saturate-125 bg-surface-container-highest/65 border-b border-gray-400/20 dark:border-gray-800/60 h-10 flex items-center justify-between px-4 shrink-0 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                <span className="text-[13px] font-medium tracking-wide text-on-surface">Document Assistant</span>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={downloadChat} className="text-outline hover:text-primary transition-all p-1 rounded hover:bg-white/5" title="Download Chat">
                  <span className="material-symbols-outlined text-[18px]">download</span>
                </button>
                <button onClick={handleClearChat} className="text-outline hover:text-error transition-all p-1 rounded hover:bg-white/5" title="Clear Chat">
                  <span className="material-symbols-outlined text-[18px]">delete_sweep</span>
                </button>
              </div>
            </div>

            <div className="flex-grow p-4 space-y-6">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
                  {msg.sender === 'ai' && (
                    <div className="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0 border border-gray-400/20">
                      <span className="material-symbols-outlined text-primary text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>auto_awesome</span>
                    </div>
                  )}
                  <div className={`flex-1 space-y-3 ${msg.sender === 'user' ? 'max-w-[85%] flex-grow-1' : ''}`}>
                    {/* Chat Bubble ke liye conditional check */}
                    <div className={`p-3.5 rounded-xl border leading-relaxed shadow-sm ${msg.sender === 'user' ? 'bg-primary-container border-gray-400/20 text-on-surface text-body-sm' : 'bg-surface-container-low border-gray-400/20 text-on-surface text-body-sm'} ${containsUrdu(msg.text) ? 'urdu-calligraphy' : ''}`}>
                      {msg.sender === 'ai' ? (
                        <div className="prose prose-sm" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.text) }} />
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.text}</p>
                      )}
                    </div>

                    {msg.suggestions && msg.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-1">
                        {msg.suggestions.map((sug, idx) => (
                          <button key={idx} onClick={() => handleSend(sug)} className="px-3 py-1.5 rounded-full bg-surface-container-highest border border-gray-400/20 text-[11px] text-on-surface-variant hover:border-primary hover:text-primary transition-all text-left">
                            {sug}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-gray-400/20">
                      <span className="material-symbols-outlined text-on-surface-variant text-[16px]">person</span>
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3">
                  <div className="w-7 h-7 rounded-lg bg-surface-container-low flex items-center justify-center shrink-0 border border-outline-variant/10">
                    <span className="material-symbols-outlined text-primary text-[16px] animate-spin">progress_activity</span>
                  </div>
                  <div className="bg-surface-container-low/60 p-3.5 rounded-xl rounded-tl-none max-w-[80%]">
                    <span className="text-body-sm text-outline italic">AI is formulating response...</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="sticky bottom-0 z-10 backdrop-blur-xl backdrop-saturate-125 bg-surface-container-highest/65 p-4 border-t border-gray-400/20 shrink-0">
              <div className="relative flex items-end gap-2 bg-surface-container-low/40 rounded-xl border border-gray-400/20 p-2.5 focus-within:border-primary transition-all shadow-sm">
                <textarea
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  // Input area ke liye conditional check
                  className={`flex-1 bg-transparent border-none focus:ring-0 text-body-sm py-1.5 resize-none outline-none text-on-surface ${containsUrdu(inputText) ? 'urdu-calligraphy' : ''}`}
                  placeholder="Ask about this document..."
                  rows={1}
                />
                <div className="flex items-center gap-1.5">
                  <button onClick={() => handleSend()} disabled={loading || !inputText.trim()} className="w-8 h-8 rounded-lg bg-primary text-on-primary flex items-center justify-center hover:brightness-105 transition-all disabled:opacity-40">
                    <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}