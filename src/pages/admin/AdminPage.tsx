import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, Database, CreditCard, Activity, FileText, 
  Settings, HeartPulse, LogOut, Lock, Key, AlertTriangle, Home
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { authService } from '../../services/auth/auth.service';

// Import Types
import { AdminUser, AdminProduct, AdminTransaction, WalletLedger, AuditLogEntry, SystemSettings } from './types';

// Import Initial Data and LocalStorage helpers
import { 
  initialUsers, initialProducts, initialTransactions, initialLedger, 
  initialAuditLogs, initialSettings, loadFromStorage, saveToStorage, generateId 
} from './dataStore';

// Import Tab Components
import { AdminDashboard } from './components/AdminDashboard';
import { AdminUsers } from './components/AdminUsers';
import { AdminProductSettings } from './components/AdminProductSettings';
import { AdminOperations } from './components/AdminOperations';
import { AdminFeatureTests } from './components/AdminFeatureTests';

export const AdminPage: React.FC = () => {
  const navigate = useNavigate();

  // Active role templates for live testing
  const [activeAdminUser, setActiveAdminUser] = useState<AdminUser>(() => {
    return initialUsers[0]; // Ahmad Faisal (Super Admin) as default
  });

  // 2. Core Data Lists States
  const [users, setUsers] = useState<AdminUser[]>(() => loadFromStorage<AdminUser[]>('users', initialUsers));
  const [products, setProducts] = useState<AdminProduct[]>(() => loadFromStorage<AdminProduct[]>('products', initialProducts));
  const [transactions, setTransactions] = useState<AdminTransaction[]>(() => loadFromStorage<AdminTransaction[]>('transactions', initialTransactions));
  const [ledger, setLedger] = useState<WalletLedger[]>(() => loadFromStorage<WalletLedger[]>('ledger', initialLedger));
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => loadFromStorage<AuditLogEntry[]>('audit_logs', initialAuditLogs));
  const [settings, setSettings] = useState<SystemSettings>(() => loadFromStorage<SystemSettings>('settings', initialSettings));

  // 3. Navigation Sidebar State
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'products' | 'operations' | 'tests'>('dashboard');

  // Sync to local storage whenever state changes
  useEffect(() => {
    saveToStorage('users', users);
  }, [users]);

  useEffect(() => {
    saveToStorage('products', products);
  }, [products]);

  useEffect(() => {
    saveToStorage('transactions', transactions);
  }, [transactions]);

  useEffect(() => {
    saveToStorage('ledger', ledger);
  }, [ledger]);

  useEffect(() => {
    saveToStorage('audit_logs', auditLogs);
  }, [auditLogs]);

  useEffect(() => {
    saveToStorage('settings', settings);
  }, [settings]);

  // Helper to record audit events
  const recordAuditEvent = (event: string, description: string) => {
    const newLog: AuditLogEntry = {
      id: generateId('log'),
      user: activeAdminUser.email,
      correlationId: `corr-admin-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`,
      requestId: `req-admin-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 6)}`,
      event,
      description,
      date: new Date().toISOString()
    };
    setAuditLogs(prev => [newLog, ...prev]);
  };

  const handleAdminLogout = async () => {
    recordAuditEvent('ADMIN_LOGOUT', 'Sesi admin CMS berhasil ditutup (Logout).');
    await authService.logout();
    navigate('/login');
  };

  // User Management Handlers
  const handleAddUser = (newUser: Omit<AdminUser, 'id' | 'createdAt'>) => {
    const createdUser: AdminUser = {
      ...newUser,
      id: generateId('usr'),
      createdAt: new Date().toISOString()
    };
    setUsers(prev => [...prev, createdUser]);
    recordAuditEvent('USER_CREATE', `Pendaftaran user baru berhasil: ${newUser.name} (${newUser.email}).`);
  };

  const handleUpdateUser = (id: string, updates: Partial<AdminUser>) => {
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...updates } : u));
    const target = users.find(u => u.id === id);
    recordAuditEvent('USER_UPDATE', `Pembaruan data / hak akses pengguna: ${target?.name || id}.`);
  };

  const handleDeleteUser = (id: string) => {
    const target = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    recordAuditEvent('USER_DELETE', `Akun pengguna berhasil dihapus: ${target?.name || id}.`);
  };

  // Product Catalog Handlers
  const handleAddProduct = (newProduct: Omit<AdminProduct, 'id'>) => {
    const createdProduct: AdminProduct = {
      ...newProduct,
      id: generateId('prd')
    };
    setProducts(prev => [createdProduct, ...prev]);
    recordAuditEvent('PRODUCT_CREATE', `Registrasi SKU produk baru berhasil: ${newProduct.name} (${newProduct.skuCode}).`);
  };

  const handleUpdateProduct = (id: string, updates: Partial<AdminProduct>) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
    const target = products.find(p => p.id === id);
    if (updates.status) {
      recordAuditEvent('PRODUCT_STATUS_UPDATE', `Ubah status produk ${target?.name}: ${updates.status.toUpperCase()}`);
    } else if (updates.margin !== undefined) {
      recordAuditEvent('PRODUCT_MARGIN_UPDATE', `Ubah margin produk ${target?.name} menjadi Rp${updates.margin}`);
    } else {
      recordAuditEvent('PRODUCT_UPDATE', `Modifikasi produk berhasil diselesaikan untuk: ${target?.name || id}`);
    }
  };

  // Settings Handlers
  const handleUpdateSettings = (newSettings: SystemSettings) => {
    setSettings(newSettings);
    recordAuditEvent('SETTINGS_UPDATE', `Pengaturan gateway & Feature Flags diperbarui secara masal.`);
  };

  // Transaction Intervention Handlers
  const handleManualRetry = (id: string) => {
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'sukses', note: 'Transaksi diselesaikan via retry manual admin.' } : t));
    const target = transactions.find(t => t.id === id);
    recordAuditEvent('TRANSACTION_RETRY', `Intervensi Manual: Retry sukses dipicu untuk invoice ${target?.transactionCode}`);
  };

  const handleManualRefund = (id: string) => {
    const target = transactions.find(t => t.id === id);
    if (!target) return;

    // Refund Logic: Update transaction to failed
    setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'gagal', note: 'Transaksi dibatalkan & dana dikembalikan (Refunded).' } : t));

    // Find user by phone to return funds
    const matchedUser = users.find(u => u.phone === target.targetNo || u.walletNo === target.targetNo);
    if (matchedUser) {
      const balanceBefore = matchedUser.walletBalance;
      const balanceAfter = balanceBefore + target.amount;

      // Update user wallet
      setUsers(prev => prev.map(u => u.id === matchedUser.id ? { ...u, walletBalance: balanceAfter } : u));

      // Add Ledger record
      const newLedger: WalletLedger = {
        id: generateId('ld'),
        userId: matchedUser.id,
        userName: matchedUser.name,
        type: 'credit',
        action: 'refund',
        amount: target.amount,
        balanceBefore,
        balanceAfter,
        date: new Date().toISOString(),
        note: `Refund dana otomatis/manual transaksi gagal invoice: ${target.transactionCode}`
      };
      setLedger(prev => [newLedger, ...prev]);
    }

    recordAuditEvent('TRANSACTION_REFUND', `Intervensi Manual: Refund dana berhasil diselesaikan untuk invoice ${target.transactionCode}`);
  };

  // Wallet Manual Adjustments Handler
  const handleWalletAdjustment = (userId: string, type: 'credit' | 'debit', action: 'topup' | 'adjustment', amount: number, note: string) => {
    const target = users.find(u => u.id === userId);
    if (!target) return;

    const balanceBefore = target.walletBalance;
    const balanceAfter = type === 'credit' ? balanceBefore + amount : balanceBefore - amount;

    // Update user balance
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, walletBalance: balanceAfter } : u));

    // Add Ledger record
    const newLedger: WalletLedger = {
      id: generateId('ld'),
      userId,
      userName: target.name,
      type,
      action,
      amount,
      balanceBefore,
      balanceAfter,
      date: new Date().toISOString(),
      note
    };
    setLedger(prev => [newLedger, ...prev]);

    // Record system audit log
    recordAuditEvent('WALLET_ADJUSTMENT', `Penyesuaian saldo ${type.toUpperCase()} user ${target.name} sebesar Rp${amount.toLocaleString('id-ID')}.`);
  };

  // Reset Storage back to defaults
  const handleResetStorage = () => {
    localStorage.removeItem('admin_cms_users');
    localStorage.removeItem('admin_cms_products');
    localStorage.removeItem('admin_cms_transactions');
    localStorage.removeItem('admin_cms_ledger');
    localStorage.removeItem('admin_cms_audit_logs');
    localStorage.removeItem('admin_cms_settings');
    
    setUsers(initialUsers);
    setProducts(initialProducts);
    setTransactions(initialTransactions);
    setLedger(initialLedger);
    setAuditLogs(initialAuditLogs);
    setSettings(initialSettings);
    
    recordAuditEvent('SYSTEM_RESET', 'Basis data disetel ulang kembali ke data bawaan awal.');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex text-slate-800 font-sans">
      
      {/* SIDEBAR NAVIGATION PANEL */}
      <aside className="w-64 bg-slate-900 text-slate-300 border-r border-slate-800 flex flex-col justify-between shrink-0 hidden md:flex">
        <div>
          {/* Logo brand */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-2.5">
            <span className="bg-indigo-600 p-1.5 rounded-lg text-white">
              <Shield size={20} />
            </span>
            <div>
              <span className="font-extrabold text-white text-sm block tracking-tight">GurkyPay CMS</span>
              <span className="text-[10px] text-indigo-400 block font-bold uppercase tracking-wider">Super Administrator</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Activity size={15} />
              <span>Dashboard Observabilitas</span>
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'users' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Users size={15} />
              <span>User &amp; Role Management</span>
            </button>

            <button
              onClick={() => setActiveTab('products')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'products' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <Database size={15} />
              <span>Product &amp; Margin</span>
            </button>

            <button
              onClick={() => setActiveTab('operations')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'operations' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <CreditCard size={15} />
              <span>Operations &amp; Ledgers</span>
            </button>

            <button
              onClick={() => setActiveTab('tests')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'tests' ? 'bg-indigo-600 text-white' : 'hover:bg-slate-800/60 hover:text-white'
              }`}
            >
              <HeartPulse size={15} />
              <span>Automated Harness Tests</span>
            </button>
          </nav>
        </div>

        {/* Sidebar Footer info */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="bg-slate-800 p-2 rounded-full font-bold text-white text-xs">
              AF
            </div>
            <div>
              <span className="text-xs font-bold text-white block">Ahmad Faisal</span>
              <span className="text-[9px] text-gray-500 block">Super Admin</span>
            </div>
          </div>

          <button
            onClick={handleResetStorage}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[10px] font-bold py-1.5 rounded transition border border-slate-700/60 flex items-center justify-center gap-1"
          >
            Reset Database CMS
          </button>

          <button
            onClick={handleAdminLogout}
            className="w-full bg-red-600/10 hover:bg-red-600/20 text-red-400 text-[10px] font-bold py-1.5 rounded transition border border-red-500/20 flex items-center justify-center gap-1"
          >
            <LogOut size={12} />
            Logout Sesi CMS
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SECTION */}
      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Header Row */}
        <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-6 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium text-xs hidden md:inline">Dashboard Administrasi</span>
            <span className="text-gray-300 hidden md:inline">/</span>
            <span className="font-extrabold text-xs text-indigo-600 capitalize">
              {activeTab === 'tests' ? 'Harness Tests' : activeTab}
            </span>
          </div>

          {/* Quick status information */}
          <div className="flex items-center gap-4 text-xs font-semibold">
            {settings.maintenanceMode && (
              <span className="bg-red-50 text-red-700 border border-red-100 text-[10px] px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1 font-bold">
                <AlertTriangle size={12} />
                Mode Pemeliharaan Aktif
              </span>
            )}
            
            <div className="bg-gray-100 p-1.5 rounded-lg border border-gray-200 flex items-center gap-1.5 font-bold text-[10px] text-gray-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Platform: Normal
            </div>

            <button
              onClick={handleAdminLogout}
              className="text-gray-500 hover:text-red-600 p-1 rounded-lg transition"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </header>

        {/* Dynamic Inner Tab Router Container */}
        <main className="flex-1 overflow-y-auto p-6 max-w-7xl w-full mx-auto">
          {activeTab === 'dashboard' && (
            <AdminDashboard 
              users={users} 
              products={products} 
              transactions={transactions} 
              onRefresh={() => {
                recordAuditEvent('DASHBOARD_REFRESH', 'Metrik observabilitas diperbarui secara manual.');
              }} 
            />
          )}

          {activeTab === 'users' && (
            <AdminUsers
              users={users}
              onAddUser={handleAddUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {activeTab === 'products' && (
            <AdminProductSettings
              products={products}
              settings={settings}
              onAddProduct={handleAddProduct}
              onUpdateProduct={handleUpdateProduct}
              onUpdateSettings={handleUpdateSettings}
            />
          )}

          {activeTab === 'operations' && (
            <AdminOperations
              transactions={transactions}
              users={users}
              ledger={ledger}
              auditLogs={auditLogs}
              onManualRetry={handleManualRetry}
              onManualRefund={handleManualRefund}
              onWalletAdjustment={handleWalletAdjustment}
            />
          )}

          {activeTab === 'tests' && (
            <AdminFeatureTests />
          )}
        </main>
      </div>
    </div>
  );
};
