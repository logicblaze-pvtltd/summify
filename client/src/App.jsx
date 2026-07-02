import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Chat from './pages/Chat';
import Settings from './pages/Settings';

export default function App() {
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [theme, setTheme] = useState('light');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch documents from server
  const refreshDocuments = async () => {
    try {
      const res = await fetch('/api/documents');
      if (res.ok) {
        const data = await res.json();
        setDocuments(data);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  useEffect(() => {
    refreshDocuments();
  }, []);

  // Sync theme with HTML document element
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [theme]);

  const handleSelectDocument = (id) => {
    setSelectedDocId(id);
    setCurrentView('chat');
  };

  const handleNewSummary = () => {
    setSelectedDocId(null);
    setCurrentView('dashboard');
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const renderActivePage = () => {
    switch (currentView) {
      case 'dashboard':
        return (
          <Dashboard
            onSelectDocument={handleSelectDocument}
            onViewChange={setCurrentView}
            documents={documents}
            refreshDocuments={refreshDocuments}
          />
        );
      case 'library':
        return (
          <Library
            documents={documents}
            refreshDocuments={refreshDocuments}
            onSelectDocument={handleSelectDocument}
          />
        );
      case 'chat':
        return (
          <Chat
            docId={selectedDocId}
            documents={documents}
            refreshDocuments={refreshDocuments}
            onNewSummary={handleNewSummary}
          />
        );
      case 'settings':
        return (
          <Settings
            theme={theme}
            onThemeChange={setTheme}
            refreshDocuments={refreshDocuments}
          />
        );
      default:
        return (
          <Dashboard
            onSelectDocument={handleSelectDocument}
            onViewChange={setCurrentView}
            documents={documents}
            refreshDocuments={refreshDocuments}
          />
        );
    }
  };

  return (
    <div className={`flex min-h-screen bg-background text-on-surface transition-colors duration-200 ${theme === 'dark' ? 'dark-mode' : ''}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        currentView={currentView}
        onViewChange={setCurrentView}
        onNewSummary={handleNewSummary}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden h-screen">
        {renderActivePage()}

        {/* Mobile Bottom Navigation (Visible only on mobile devices) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-surface/90 backdrop-blur-lg border-t border-outline-variant flex items-center justify-around px-4 z-50 rounded-t-3xl shadow-2xl">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex flex-col items-center gap-1 ${currentView === 'dashboard' ? 'text-primary' : 'text-outline'}`}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </button>
          
          <button
            onClick={() => setCurrentView('library')}
            className={`flex flex-col items-center gap-1 ${currentView === 'library' ? 'text-primary' : 'text-outline'}`}
          >
            <span className="material-symbols-outlined">library_books</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Library</span>
          </button>
          
          <div className="flex flex-col items-center -mt-10">
            <button
              onClick={handleNewSummary}
              className="w-14 h-14 bg-primary text-on-primary rounded-2xl flex items-center justify-center shadow-xl shadow-primary/30 active:scale-90 transition-all"
            >
              <span className="material-symbols-outlined text-3xl">add</span>
            </button>
          </div>
          
          <button
            onClick={() => setCurrentView('settings')}
            className={`flex flex-col items-center gap-1 ${currentView === 'settings' ? 'text-primary' : 'text-outline'}`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Config</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
