import { useState, FormEvent } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { 
  Smartphone, 
  Wifi, 
  Zap, 
  CreditCard, 
  Gift, 
  Send, 
  History, 
  Bell, 
  User, 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  ShieldCheck, 
  Copy,
  PlusCircle,
  FileText
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useWallet } from '../../hooks/useWallet';
import { useTransactions } from '../../hooks/useTransactions';
import { useNotifications } from '../../hooks/useNotifications';
import { useProfile } from '../../hooks/useProfile';
import { LoadingState } from '../../components/ui/FeedbackStates';

export const PlaceholderServicePage = () => {
  const location = useLocation();
  const path = location.pathname;

  const { user } = useAuth();
  const { wallet, loading: walletLoading } = useWallet(true);
  const { transactions, loading: trxLoading } = useTransactions(true);
  const { notifications, loading: notifLoading } = useNotifications(true);
  const { profile, loading: profileLoading } = useProfile();

  // Form states
  const [phoneNo, setPhoneNo] = useState('');
  const [plnId, setPlnId] = useState('');
  const [nominal, setNominal] = useState<number | null>(null);
  const [selectedPack, setSelectedPack] = useState<string | null>(null);
  const [transferBank, setTransferBank] = useState('');
  const [transferRek, setTransferRek] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [alertMsg, setAlertMsg] = useState<{ type: 'success' | 'info'; text: string } | null>(null);

  if (walletLoading || trxLoading || notifLoading || profileLoading) {
    return (
      <div className="flex items-center justify-center p-8 bg-white rounded-3xl border border-gray-100 shadow-md">
        <LoadingState title="Menyiapkan halaman..." description="Sedang memuat data layanan Anda." />
      </div>
    );
  }

  // Helper to format currency
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(value);
  };

  const handleSimulateAction = (e: FormEvent, serviceName: string) => {
    e.preventDefault();
    setAlertMsg({
      type: 'info',
      text: `Layanan ${serviceName} berhasil disimulasikan. Transaksi riil dinonaktifkan di Sprint 5 (Belum terhubung ke API Laravel / Digiflazz).`
    });
    setTimeout(() => setAlertMsg(null), 5000);
  };

  // 1. PULSA PAGE
  if (path.includes('pulsa')) {
    const nominals = [5000, 10000, 20000, 50000, 100000, 200000];
    return (
      <div className="max-w-2xl bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">Isi Pulsa</h3>
            <p className="text-xs text-gray-500 font-medium">Beli pulsa instan ke semua operator Indonesia</p>
          </div>
        </div>

        {alertMsg && (
          <div className="p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary-600 mt-0.5" />
            <span>{alertMsg.text}</span>
          </div>
        )}

        <form onSubmit={(e) => handleSimulateAction(e, 'Pulsa')} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nomor Handphone</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <input
                type="tel"
                required
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-2xl text-gray-900 font-medium outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Operator akan terdeteksi secara otomatis</p>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3.5">Pilih Nominal Pulsa</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {nominals.map((nom) => (
                <button
                  type="button"
                  key={nom}
                  onClick={() => setNominal(nom)}
                  className={`p-4 rounded-2xl border text-left transition-all ${nominal === nom ? 'bg-primary-50 border-primary-500 text-primary-800 ring-2 ring-primary-500/10' : 'bg-gray-50 border-gray-100 hover:border-gray-300 text-gray-800'}`}
                >
                  <div className="text-xs font-bold text-gray-400">PULSA</div>
                  <div className="text-lg font-black mt-1">{formatIDR(nom).replace('Rp', '')}</div>
                  <div className="text-[10px] font-bold text-primary-600 mt-2">Harga: {formatIDR(nom + 1200)}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold py-4 rounded-full shadow-lg shadow-primary-500/20 transition-all active:scale-95 text-center block"
          >
            Beli Pulsa Sekarang
          </button>
        </form>
      </div>
    );
  }

  // 2. PAKET DATA
  if (path.includes('paket-data')) {
    const packages = [
      { id: 'p1', name: 'Freedom Internet 10GB', desc: 'Full Kuota Utama 24 Jam • 30 Hari', price: 35000 },
      { id: 'p2', name: 'Freedom Internet 30GB', desc: 'Full Kuota Utama 24 Jam • 30 Hari', price: 79000 },
      { id: 'p3', name: 'Kuota Sultan 50GB', desc: 'Full Kuota Utama + Apps Unlimited • 30 Hari', price: 110000 },
      { id: 'p4', name: 'Harian Hemat 2GB', desc: 'Kuota Utama 24 Jam • 3 Hari', price: 12000 }
    ];
    return (
      <div className="max-w-2xl bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">Paket Data</h3>
            <p className="text-xs text-gray-500 font-medium">Beli paket internet super hemat operator Indonesia</p>
          </div>
        </div>

        {alertMsg && (
          <div className="p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary-600 mt-0.5" />
            <span>{alertMsg.text}</span>
          </div>
        )}

        <form onSubmit={(e) => handleSimulateAction(e, 'Paket Data')} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Nomor Handphone</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Wifi className="w-5 h-5" />
              </div>
              <input
                type="tel"
                required
                value={phoneNo}
                onChange={(e) => setPhoneNo(e.target.value)}
                placeholder="Contoh: 081234567890"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-2xl text-gray-900 font-medium outline-none transition-all"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700">Pilih Paket Internet</label>
            {packages.map((pack) => (
              <button
                type="button"
                key={pack.id}
                onClick={() => setSelectedPack(pack.name)}
                className={`w-full p-4 rounded-2xl border text-left transition-all flex items-center justify-between ${selectedPack === pack.name ? 'bg-primary-50 border-primary-500 text-primary-800 ring-2 ring-primary-500/10' : 'bg-gray-50 border-gray-100 hover:border-gray-200 text-gray-800'}`}
              >
                <div>
                  <div className="font-extrabold text-sm">{pack.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5">{pack.desc}</div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <div className="font-black text-sm text-primary-600">{formatIDR(pack.price)}</div>
                </div>
              </button>
            ))}
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold py-4 rounded-full shadow-lg shadow-primary-500/20 transition-all active:scale-95 text-center block"
          >
            Beli Paket Data Sekarang
          </button>
        </form>
      </div>
    );
  }

  // 3. TOKEN PLN
  if (path.includes('token-pln')) {
    const nominals = [20000, 50000, 100000, 200000, 500000, 1000000];
    return (
      <div className="max-w-2xl bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">Token PLN</h3>
            <p className="text-xs text-gray-500 font-medium">Beli token listrik prabayar PLN secara instan</p>
          </div>
        </div>

        {alertMsg && (
          <div className="p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary-600 mt-0.5" />
            <span>{alertMsg.text}</span>
          </div>
        )}

        <form onSubmit={(e) => handleSimulateAction(e, 'Token PLN')} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">No. Meter / ID Pelanggan</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Zap className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={plnId}
                onChange={(e) => setPlnId(e.target.value)}
                placeholder="Contoh: 14028394819"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-2xl text-gray-900 font-medium outline-none transition-all"
              />
            </div>
            {plnId.length > 5 && (
              <div className="mt-2.5 p-3.5 bg-green-50/50 border border-green-100 rounded-2xl text-xs font-bold text-green-800 flex justify-between items-center">
                <span>Nama Pelanggan: BUDI GURKY</span>
                <span className="text-green-600 font-black">Tarif: R1/900VA</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-3.5">Pilih Nominal Token</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {nominals.map((nom) => (
                <button
                  type="button"
                  key={nom}
                  onClick={() => setNominal(nom)}
                  className={`p-4 rounded-2xl border text-left transition-all ${nominal === nom ? 'bg-primary-50 border-primary-500 text-primary-800 ring-2 ring-primary-500/10' : 'bg-gray-50 border-gray-100 hover:border-gray-300 text-gray-800'}`}
                >
                  <div className="text-xs font-bold text-gray-400">PLN</div>
                  <div className="text-lg font-black mt-1">{formatIDR(nom).replace('Rp', '')}</div>
                  <div className="text-[10px] font-bold text-primary-600 mt-2">Biaya: {formatIDR(nom + 1500)}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold py-4 rounded-full shadow-lg shadow-primary-500/20 transition-all active:scale-95 text-center block"
          >
            Beli Token Sekarang
          </button>
        </form>
      </div>
    );
  }

  // 4. TRANSFER
  if (path.includes('transfer')) {
    const banks = ['BCA', 'Mandiri', 'BRI', 'BNI', 'Gopay', 'OVO', 'Dana'];
    return (
      <div className="max-w-2xl bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">Kirim Dana</h3>
            <p className="text-xs text-gray-500 font-medium">Transfer saldo GurkyPay ke Bank atau E-Wallet gratis biaya admin</p>
          </div>
        </div>

        {alertMsg && (
          <div className="p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary-600 mt-0.5" />
            <span>{alertMsg.text}</span>
          </div>
        )}

        <form onSubmit={(e) => handleSimulateAction(e, 'Transfer')} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Pilih Bank / Tujuan</label>
            <select
              required
              value={transferBank}
              onChange={(e) => setTransferBank(e.target.value)}
              className="w-full px-4 py-3.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-2xl text-gray-900 font-bold outline-none transition-all"
            >
              <option value="">-- Pilih Tujuan --</option>
              {banks.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">No. Rekening / No. HP Tujuan</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-400">
                <Send className="w-5 h-5" />
              </div>
              <input
                type="text"
                required
                value={transferRek}
                onChange={(e) => setTransferRek(e.target.value)}
                placeholder="Contoh: 8401928491 atau 0812345678"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-2xl text-gray-900 font-medium outline-none transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Jumlah Transfer</label>
            <div className="relative">
              <span className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-gray-900 font-black text-sm">Rp</span>
              <input
                type="number"
                required
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                placeholder="Minimum Rp 10.000"
                className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-2xl text-gray-900 font-bold outline-none transition-all"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1.5">Maksimum transfer harian: Rp 10.000.000</p>
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold py-4 rounded-full shadow-lg shadow-primary-500/20 transition-all active:scale-95 text-center block"
          >
            Kirim Dana Sekarang
          </button>
        </form>
      </div>
    );
  }

  // 5. PROFILE PAGE
  if (path.includes('profil')) {
    return (
      <div className="max-w-2xl bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-8">
        <div className="flex items-center gap-3.5 border-b border-gray-50 pb-5">
          <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">Profil Saya</h3>
            <p className="text-xs text-gray-500 font-medium">Atur data diri dan verifikasi keamanan akun GurkyNet Anda</p>
          </div>
        </div>

        {alertMsg && (
          <div className="p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary-600 mt-0.5" />
            <span>{alertMsg.text}</span>
          </div>
        )}

        {/* User Card */}
        <div className="flex flex-col sm:flex-row items-center gap-5 bg-gray-50 p-6 rounded-3xl border border-gray-100">
          <img 
            src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256'} 
            alt={user?.name || 'User'}
            referrerPolicy="no-referrer"
            className="w-20 h-20 rounded-2xl object-cover shadow-md border border-white"
          />
          <div className="text-center sm:text-left space-y-1">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <h4 className="text-lg font-black text-gray-900">{user?.name || 'User GurkyNet'}</h4>
              <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-2.5 py-0.5 rounded-full w-fit mx-auto sm:mx-0">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                {profile?.kycStatus === 'verified' ? 'Terverifikasi' : profile?.kycStatus === 'pending' ? 'Diproses' : 'Belum Verifikasi'}
              </span>
            </div>
            <p className="text-xs text-gray-500 font-semibold">{user?.role || 'User Member'}</p>
            <p className="text-xs text-gray-400">{user?.email} • {user?.phone}</p>
          </div>
        </div>

        {/* Settings details list */}
        <div className="space-y-4">
          <h5 className="font-extrabold text-gray-900 text-sm">Pengaturan Akun</h5>
          
          <div className="divide-y divide-gray-50 border border-gray-100 rounded-2xl p-4 bg-white">
            <div className="py-3 flex justify-between items-center text-sm">
              <span className="font-bold text-gray-500">Ubah Password</span>
              <button 
                onClick={(e) => handleSimulateAction(e, 'Ubah Password')}
                className="text-xs font-bold text-primary-600 hover:underline"
              >
                Ubah
              </button>
            </div>
            <div className="py-3 flex justify-between items-center text-sm">
              <span className="font-bold text-gray-500">Verifikasi KTP / KYC</span>
              {profile?.kycStatus === 'verified' ? (
                <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                  Selesai <CheckCircle className="w-4 h-4" />
                </span>
              ) : profile?.kycStatus === 'pending' ? (
                <span className="text-xs font-bold text-amber-600">
                  Diproses (Verifikasi)
                </span>
              ) : (
                <button 
                  onClick={(e) => handleSimulateAction(e, 'Kirim KYC KTP')}
                  className="text-xs font-bold text-primary-600 hover:underline"
                >
                  Ajukan Verifikasi
                </button>
              )}
            </div>
            <div className="py-3 flex justify-between items-center text-sm">
              <span className="font-bold text-gray-500">Hubungkan WhatsApp</span>
              <span className="text-xs font-bold text-gray-700">{user?.phone || '081234567890'}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 6. WALLET PAGE
  if (path.includes('wallet')) {
    return (
      <div className="max-w-2xl bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
        <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
          <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">GurkyPay Wallet</h3>
            <p className="text-xs text-gray-500 font-medium">Kelola saldo, point, dan isi ulang instan</p>
          </div>
        </div>

        {alertMsg && (
          <div className="p-4 bg-primary-50 border border-primary-200 text-primary-800 rounded-2xl text-sm font-semibold flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-primary-600 mt-0.5" />
            <span>{alertMsg.text}</span>
          </div>
        )}

        <div className="bg-gradient-to-br from-primary-800 to-primary-600 rounded-3xl p-6 text-white space-y-6">
          <div className="flex justify-between items-center">
            <span className="text-xs text-primary-200 font-bold uppercase tracking-wider">GurkyPay Card</span>
            <span className="text-xs font-bold bg-white/20 px-2.5 py-1 rounded-full border border-white/10">{wallet?.walletNo || 'GK-XXXXXXXX'}</span>
          </div>
          <div>
            <div className="text-xs text-primary-200 font-medium">Total Saldo Aktif</div>
            <h4 className="text-3xl font-black mt-1 tracking-tight">{formatIDR(wallet?.balance || 0)}</h4>
          </div>
          <div className="flex justify-between items-center pt-4 border-t border-white/10 text-xs">
            <div>
              <div className="text-primary-200">Point Reward</div>
              <div className="font-bold text-sm text-yellow-300 mt-0.5">{wallet?.points || 0} Pts</div>
            </div>
            <div>
              <div className="text-primary-200">Status Akun</div>
              <div className="font-bold text-sm text-green-300 mt-0.5">Aktif / Premium</div>
            </div>
          </div>
        </div>

        <form onSubmit={(e) => handleSimulateAction(e, 'Top Up Wallet')} className="space-y-4">
          <h5 className="font-extrabold text-gray-900 text-sm">Simulasi Isi Ulang (Top Up)</h5>
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">Pilih Nominal Top Up</label>
            <div className="grid grid-cols-3 gap-2">
              {[50000, 100000, 250000, 500000, 1000000].map((v) => (
                <button
                  type="button"
                  key={v}
                  onClick={() => setTransferAmount(String(v))}
                  className={`p-3 text-xs font-extrabold rounded-xl border text-center transition-all ${transferAmount === String(v) ? 'bg-primary-50 border-primary-500 text-primary-800' : 'bg-gray-50 border-gray-100'}`}
                >
                  {formatIDR(v).replace('Rp', '')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-2">Metode Pembayaran</label>
            <select className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-2xl text-xs font-bold text-gray-900 outline-none">
              <option>Virtual Account (BCA, Mandiri, BRI)</option>
              <option>Instan Alfamart / Indomaret</option>
              <option>QRIS Mandiri / OVO / Dana</option>
            </select>
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white font-extrabold py-3.5 rounded-full shadow-md text-sm transition-all"
          >
            Proses Top Up
          </button>
        </form>
      </div>
    );
  }

  // 7. RIWAYAT / NOTIFIKASI FALLBACKS
  const isNotification = path.includes('notifikasi');

  return (
    <div className="max-w-2xl bg-white rounded-3xl p-6 md:p-8 border border-gray-100 shadow-xl shadow-gray-200/40 space-y-6">
      <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
        <Link to="/dashboard" className="w-10 h-10 rounded-xl bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h3 className="text-xl font-extrabold text-gray-900 capitalize">
            {isNotification ? 'Notifikasi Masuk' : path.split('/').pop()?.replace('-', ' ')}
          </h3>
          <p className="text-xs text-gray-500 font-medium">
            {isNotification 
              ? 'Informasi promo, status transaksi, dan pemeliharaan jaringan' 
              : 'Riwayat transaksi lengkap, status, dan riwayat tagihan Anda'
            }
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {isNotification ? (
          notifications.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Tidak ada notifikasi baru</div>
          ) : (
            notifications.map((notif) => (
              <div key={notif.id} className={`p-4 rounded-2xl border transition-all ${notif.isRead ? 'bg-gray-50/50 border-gray-100' : 'bg-primary-50/30 border-primary-100 shadow-sm'}`}>
                <div className="flex items-start gap-3">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${notif.isRead ? 'bg-gray-100 text-gray-400' : 'bg-primary-100 text-primary-600'}`}>
                    <Bell className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-sm text-gray-900 block truncate">{notif.title}</span>
                      <span className="text-[9px] font-bold text-gray-400 shrink-0">
                        {notif.createdAt.includes('T') ? new Date(notif.createdAt).toLocaleDateString('id-ID') : notif.createdAt}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{notif.message}</p>
                  </div>
                </div>
              </div>
            ))
          )
        ) : (
          transactions.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm">Tidak ada riwayat transaksi</div>
          ) : (
            transactions.map((tx) => (
              <div key={tx.id} className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-white border border-gray-100 flex items-center justify-center text-primary-600 shrink-0">
                    {tx.serviceName === 'Pulsa' ? <Smartphone className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-gray-900">{tx.productName}</div>
                    <div className="text-[10px] text-gray-400 font-medium mt-0.5">
                      {tx.targetNo} • {tx.date.includes('T') ? new Date(tx.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : tx.date}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-black text-sm text-gray-900">{formatIDR(tx.amount)}</div>
                  <span className={`inline-block text-[9px] font-black uppercase tracking-wider mt-1 px-2 py-0.5 rounded-full ${
                    tx.status === 'sukses' ? 'bg-green-100 text-green-700' :
                    tx.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                  }`}>{tx.status}</span>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  );
};
