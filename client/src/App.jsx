import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';

export default function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('user');
    try {
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  
  const [token, setToken] = useState(() => {
    return localStorage.getItem('token') || null;
  });

  const [documents, setDocuments] = useState([]);
  const [guestQuota, setGuestQuota] = useState(null);
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme');
    return saved === 'dark' || saved === 'light' ? saved : 'light';
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Route guarding
  useEffect(() => {
    const publicRoutes = ['/login', '/register'];
    const isPublic = publicRoutes.includes(location.pathname);
    
    if (token && isPublic) {
      navigate('/');
    }
  }, [token, location.pathname, navigate]);

  // Fetch documents from server
  const refreshDocuments = async () => {
    try {
      const [documentsResponse, quotaResponse] = await Promise.all([
        fetch('/api/documents'),
        token ? Promise.resolve(null) : fetch('/api/guest/quota')
      ]);

      if (documentsResponse.ok) {
        const data = await documentsResponse.json();
        setDocuments(data);
      }

      if (token) {
        setGuestQuota(null);
      } else if (quotaResponse && quotaResponse.ok) {
        const quotaData = await quotaResponse.json();
        setGuestQuota(quotaData);
      } else {
        setGuestQuota(null);
      }
    } catch (err) {
      console.error('Error fetching documents:', err);
    }
  };

  useEffect(() => {
    refreshDocuments();
  }, [token]);

  // Sync theme with HTML document element and persist to localStorage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.remove('light');
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const handleLoginSuccess = (newToken, newUser) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    navigate('/login');
  };

  const handleSelectDocument = (id) => {
    navigate(`/chats/${id}`);
  };

  const handleNewSummary = () => {
    navigate('/');
  };

  const handleToggleSidebar = () => {
    setSidebarCollapsed(!sidebarCollapsed);
  };

  const getCurrentView = () => {
    const path = location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path.startsWith('/library')) return 'library';
    if (path.startsWith('/chats')) return 'chat';
    if (path.startsWith('/settings')) return 'settings';
    return 'dashboard';
  };

  const isAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (isAuthPage) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
        <Route path="/register" element={<Register onLoginSuccess={handleLoginSuccess} />} />
      </Routes>
    );
  }

  return (
    <div className={`flex min-h-screen bg-background text-on-surface transition-colors duration-200 ${theme === 'dark' ? 'dark-mode' : ''}`}>
      {/* Sidebar Navigation */}
      <Sidebar
        onNewSummary={handleNewSummary}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={handleToggleSidebar}
        user={user}
        onLogout={handleLogout}
        onLogin={() => navigate('/login')}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden h-screen">
        <Routes>
          <Route
            path="/"
            element={
              <Dashboard
                onSelectDocument={handleSelectDocument}
                documents={documents}
                refreshDocuments={refreshDocuments}
                user={user}
                guestQuota={guestQuota}
              />
            }
          />
          <Route
            path="/library"
            element={
              <Library
                documents={documents}
                refreshDocuments={refreshDocuments}
                onSelectDocument={handleSelectDocument}
              />
            }
          />
          <Route
            path="/chats"
            element={
              <Chat
                documents={documents}
                refreshDocuments={refreshDocuments}
                onNewSummary={handleNewSummary}
                user={user}
              />
            }
          />
          <Route
            path="/chats/:docId"
            element={
              <Chat
                documents={documents}
                refreshDocuments={refreshDocuments}
                onNewSummary={handleNewSummary}
                user={user}
              />
            }
          />
          <Route
            path="/settings"
            element={
              <Settings
                theme={theme}
                onThemeChange={setTheme}
                refreshDocuments={refreshDocuments}
              />
            }
          />
        </Routes>

        {/* Mobile Bottom Navigation (Visible only on mobile devices) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-20 bg-surface/90 backdrop-blur-lg border-t border-outline-variant flex items-center justify-around px-4 z-50 rounded-t-3xl shadow-2xl">
          <button
            onClick={() => navigate('/')}
            className={`flex flex-col items-center gap-1 ${getCurrentView() === 'dashboard' ? 'text-primary' : 'text-outline'}`}
          >
            <span className="material-symbols-outlined">dashboard</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Home</span>
          </button>
          
          <button
            onClick={() => navigate('/library')}
            className={`flex flex-col items-center gap-1 ${getCurrentView() === 'library' ? 'text-primary' : 'text-outline'}`}
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
            onClick={() => navigate('/settings')}
            className={`flex flex-col items-center gap-1 ${getCurrentView() === 'settings' ? 'text-primary' : 'text-outline'}`}
          >
            <span className="material-symbols-outlined">settings</span>
            <span className="text-[10px] font-bold uppercase tracking-wider">Config</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
