import React, { useState } from 'react';
import { Search, Plus, Edit2, Trash2, Shield, Mail, Phone, CheckCircle, XCircle } from 'lucide-react';
import { AdminUser } from '../types';

interface UsersProps {
  users: AdminUser[];
  onAddUser: (user: Omit<AdminUser, 'id' | 'createdAt'>) => void;
  onUpdateUser: (id: string, user: Partial<AdminUser>) => void;
  onDeleteUser: (id: string) => void;
}

const ALL_PERMISSIONS = [
  { value: 'manage_users', label: 'Manage Users' },
  { value: 'manage_products', label: 'Manage Products' },
  { value: 'manage_transactions', label: 'Manage Transactions' },
  { value: 'manage_wallet', label: 'Manage Wallet / Top Up' },
  { value: 'manage_settings', label: 'Manage Settings' },
  { value: 'view_audit_logs', label: 'View Audit Logs' },
];

export const AdminUsers: React.FC<UsersProps> = ({ users, onAddUser, onUpdateUser, onDeleteUser }) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('All');
  
  // Modal states
  const [isOpen, setIsOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'Super Admin' | 'Finance Admin' | 'Product Admin' | 'User'>('User');
  const [permissions, setPermissions] = useState<string[]>([]);
  const [isVerified, setIsVerified] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);

  const openAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPhone('');
    setRole('User');
    setPermissions([]);
    setIsVerified(true);
    setWalletBalance(0);
    setIsOpen(true);
  };

  const openEditModal = (user: AdminUser) => {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phone);
    setRole(user.role);
    setPermissions(user.permissions);
    setIsVerified(user.isVerified);
    setWalletBalance(user.walletBalance);
    setIsOpen(true);
  };

  const handleTogglePermission = (permission: string) => {
    if (permissions.includes(permission)) {
      setPermissions(permissions.filter(p => p !== permission));
    } else {
      setPermissions([...permissions, permission]);
    }
  };

  const handleRoleChange = (selectedRole: any) => {
    setRole(selectedRole);
    // Auto-assign logical template permissions
    if (selectedRole === 'Super Admin') {
      setPermissions(ALL_PERMISSIONS.map(p => p.value));
    } else if (selectedRole === 'Finance Admin') {
      setPermissions(['manage_transactions', 'manage_wallet', 'view_audit_logs']);
    } else if (selectedRole === 'Product Admin') {
      setPermissions(['manage_products', 'view_audit_logs']);
    } else {
      setPermissions([]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !phone) return;

    if (editingUser) {
      onUpdateUser(editingUser.id, {
        name,
        email,
        phone,
        role,
        permissions,
        isVerified,
        walletBalance,
      });
    } else {
      const walletNo = `GP1000${Math.floor(100 + Math.random() * 900)}`;
      onAddUser({
        name,
        email,
        phone,
        role,
        permissions,
        isVerified,
        walletBalance,
        walletNo,
        points: 0,
      });
    }
    setIsOpen(false);
  };

  // Filter calculations
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(search.toLowerCase()) || 
                          user.email.toLowerCase().includes(search.toLowerCase()) ||
                          user.phone.includes(search);
    const matchesRole = roleFilter === 'All' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Search and filter row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-gray-200/80 shadow-sm">
        <div className="flex-1 relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari user berdasarkan nama, email, no handphone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:border-indigo-500 text-gray-800"
          />
        </div>

        <div className="flex items-center gap-3">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 text-gray-700 font-semibold"
          >
            <option value="All">Semua Role</option>
            <option value="Super Admin">Super Admin</option>
            <option value="Finance Admin">Finance Admin</option>
            <option value="Product Admin">Product Admin</option>
            <option value="User">User Biasa</option>
          </select>

          <button
            onClick={openAddModal}
            className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 transition active:scale-95 shadow-sm"
          >
            <Plus size={14} />
            <span>Tambah User</span>
          </button>
        </div>
      </div>

      {/* User listing table */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/70 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <th className="px-6 py-3.5">Detail Pengguna</th>
                <th className="px-6 py-3.5">Peran / Hak Akses</th>
                <th className="px-6 py-3.5">Status Verifikasi</th>
                <th className="px-6 py-3.5">Wallet Balance</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-xs font-semibold text-gray-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    Tidak ada pengguna yang memenuhi kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-6 py-4">
                      <div className="font-bold text-gray-900">{user.name}</div>
                      <div className="text-[10px] text-gray-400 font-mono mt-0.5 flex flex-col gap-0.5">
                        <span className="flex items-center gap-1"><Mail size={10} /> {user.email}</span>
                        <span className="flex items-center gap-1"><Phone size={10} /> {user.phone}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-1.5">
                        <Shield size={12} className="text-indigo-600" />
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          user.role === 'Super Admin' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                          user.role === 'Finance Admin' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          user.role === 'Product Admin' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                          'bg-gray-50 text-gray-600'
                        }`}>
                          {user.role}
                        </span>
                      </div>
                      
                      {user.permissions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 max-w-xs">
                          {user.permissions.map(perm => (
                            <span key={perm} className="bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded text-[9px] font-medium font-mono">
                              {perm}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {user.isVerified ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                          <CheckCircle size={10} />
                          Verified KYC
                        </span>
                      ) : (
                        <span className="bg-gray-100 text-gray-500 border border-gray-200 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 w-fit">
                          <XCircle size={10} />
                          Unverified
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-mono text-gray-900 font-bold">{formatIDR(user.walletBalance)}</div>
                      <div className="text-[9px] text-gray-400 mt-0.5 font-bold uppercase">No Rek: {user.walletNo}</div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => openEditModal(user)}
                          className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
                          title="Ubah Hak Akses"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => onDeleteUser(user.id)}
                          disabled={user.role === 'Super Admin'}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-30"
                          title="Hapus User"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CRUD User / Role Assignment Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl border border-gray-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-gray-900 text-sm">
                {editingUser ? `Kelola User & Role Assignment: ${editingUser.name}` : 'Tambah User & Rekening Wallet Baru'}
              </h3>
              <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-600 text-xs font-semibold">Tutup</button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Nama Lengkap</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nama Lengkap"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">No Handphone</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="0812xxxxxxxx"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Alamat Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Penugasan Peran (Role Assignment)</label>
                  <select
                    value={role}
                    onChange={(e) => handleRoleChange(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500 font-semibold"
                  >
                    <option value="User">User Biasa</option>
                    <option value="Product Admin">Product Admin</option>
                    <option value="Finance Admin">Finance Admin</option>
                    <option value="Super Admin">Super Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">KYC Status</label>
                  <div className="flex items-center gap-4 h-10">
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={isVerified}
                        onChange={() => setIsVerified(true)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Verified
                    </label>
                    <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 cursor-pointer">
                      <input
                        type="radio"
                        checked={!isVerified}
                        onChange={() => setIsVerified(false)}
                        className="text-indigo-600 focus:ring-indigo-500"
                      />
                      Unverified
                    </label>
                  </div>
                </div>
              </div>

              {/* Balance (only editable on creation for setting up account, or manual adjustments on editing if desired) */}
              {!editingUser && (
                <div>
                  <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-1.5">Saldo Awal Dompet (IDR)</label>
                  <input
                    type="number"
                    value={walletBalance}
                    onChange={(e) => setWalletBalance(Number(e.target.value))}
                    placeholder="0"
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg p-2.5 text-xs text-gray-800 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              )}

              {/* Permission Matrix */}
              <div>
                <label className="block text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Permission Matrix Assignment (Hak Akses Spesifik)
                </label>
                <div className="grid grid-cols-2 gap-2 border border-gray-100 bg-gray-50/50 p-3.5 rounded-xl">
                  {ALL_PERMISSIONS.map(p => (
                    <label key={p.value} className="flex items-start gap-2 text-xs font-semibold text-gray-600 cursor-pointer p-1 rounded hover:bg-white/80 transition">
                      <input
                        type="checkbox"
                        checked={permissions.includes(p.value)}
                        onChange={() => handleTogglePermission(p.value)}
                        className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Save trigger */}
              <div className="pt-3 border-t border-gray-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold px-4 py-2.5 rounded-lg transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold px-5 py-2.5 rounded-lg shadow-sm transition active:scale-95"
                >
                  {editingUser ? 'Simpan Perubahan' : 'Daftarkan Pengguna'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
