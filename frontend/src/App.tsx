import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Investments from './pages/Investments';
import Mpesa from './pages/Mpesa';
import Chat from './pages/Chat';
import { 
  LayoutDashboard, 
  Briefcase, 
  ArrowLeftRight, 
  BrainCircuit, 
  LogOut, 
  User as UserIcon,
  Menu,
  X,
  Wallet
} from 'lucide-react';
import { formatKES } from '@hazinahub/utils';

type TabType = 'dashboard' | 'investments' | 'mpesa' | 'chat';

function AppContent() {
  const { user, loading, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [authState, setAuthState] = useState<'login' | 'register'>('login');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column',
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--bg-main)',
        color: 'var(--text-main)'
      }}>
        <div style={{
          width: '50px',
          height: '50px',
          border: '3px solid rgba(16, 185, 129, 0.2)',
          borderTopColor: 'var(--primary)',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
          marginBottom: '16px'
        }} />
        <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Loading HazinaHub...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // Redirect to authentication if user is not logged in
  if (!user) {
    if (authState === 'login') {
      return <Login onNavigateToRegister={() => setAuthState('register')} />;
    }
    return <Register onNavigateToLogin={() => setAuthState('login')} />;
  }

  const renderActivePage = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'investments':
        return <Investments />;
      case 'mpesa':
        return <Mpesa />;
      case 'chat':
        return <Chat />;
      default:
        return <Dashboard />;
    }
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { id: 'investments', label: 'Investments', icon: <Briefcase size={18} /> },
    { id: 'mpesa', label: 'M-Pesa Transfers', icon: <ArrowLeftRight size={18} /> },
    { id: 'chat', label: 'Hazina AI Advisor', icon: <BrainCircuit size={18} /> },
  ] as const;

  return (
    <div className="app-container">
      {/* Mobile Header Bar */}
      <header style={{
        display: 'none',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-glass)',
        padding: '0 16px',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 40,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)'
      }} className="mobile-header">
        <h2 style={{ fontSize: '1.25rem' }}>HazinaHub <span style={{ color: 'var(--primary)' }}>💸</span></h2>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{ background: 'none', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '1.75rem', color: 'var(--text-main)' }}>
            HazinaHub <span style={{ color: 'var(--primary)' }}>💸</span>
          </h2>
          <button 
            className="mobile-only-close"
            onClick={() => setSidebarOpen(false)}
            style={{ display: 'none', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={20} />
          </button>
        </div>

        {/* User Card */}
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              background: 'rgba(255,255,255,0.05)',
              padding: '8px',
              borderRadius: '8px',
              color: 'var(--primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <UserIcon size={16} />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user.businessName}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                {user.firstName} {user.lastName}
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
            <span style={{ color: 'var(--text-dark)' }}>Wallet Balance:</span>
            <span style={{ fontWeight: 700, color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '2px' }}>
              <Wallet size={10} /> {formatKES((user as any).walletBalance || 0)}
            </span>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="nav-links">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                setSidebarOpen(false);
              }}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              style={{
                background: 'none',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                fontFamily: 'inherit',
                fontSize: 'inherit'
              }}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Logout button */}
        <button 
          onClick={logout}
          className="btn btn-glass"
          style={{ width: '100%', display: 'flex', gap: '8px', alignItems: 'center', padding: '12px' }}
        >
          <LogOut size={16} /> Sign Out
        </button>
      </aside>

      {/* Main Page Area */}
      <main className="main-content" style={{ marginTop: '0' }} id="app-main-content">
        {renderActivePage()}
      </main>

      <style>{`
        @media (max-width: 1024px) {
          .mobile-header {
            display: flex !important;
          }
          .mobile-only-close {
            display: block !important;
          }
          #app-main-content {
            margin-top: 60px !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
