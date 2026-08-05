import React, { useState, useEffect } from 'react';
import {
  Settings, Save, RotateCcw, Search, Globe, Mail, Phone, Share2, Server, Database, Activity, Cpu, Lock, CreditCard, ShoppingBag, Eye, EyeOff, AlertTriangle, CheckCircle2, Loader2, Send, AlertCircle
} from 'lucide-react';
import { useSystemSettingStore } from '../../store/systemSetting.store';

export const SystemSettingsCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('General');
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [testEmail, setTestEmail] = useState('');
  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});

  const {
    settings,
    systemStatus,
    loading,
    saving,
    testingEmail,
    error,
    fetchSettings,
    updateSettings,
    sendTestEmail,
    setSettingField,
    resetSettings
  } = useSystemSettingStore();

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSave = async () => {
    if (window.confirm('Apakah Anda yakin ingin menyimpan perubahan pengaturan ini?')) {
      setErrorMessage(null);
      const res = await updateSettings();
      if (res.success) {
        showNotification(res.message || 'Pengaturan berhasil disimpan.');
      } else {
        setErrorMessage(res.message || 'Gagal menyimpan pengaturan.');
      }
    }
  };

  const handleReset = () => {
    if (window.confirm('Apakah Anda yakin ingin membatalkan semua perubahan dan mengembalikan ke pengaturan semula?')) {
      resetSettings();
      showNotification('Perubahan dibatalkan.');
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) {
      alert('Masukkan alamat email tujuan tes.');
      return;
    }
    setErrorMessage(null);
    const res = await sendTestEmail(testEmail);
    if (res.success) {
      showNotification(res.message || 'Email tes berhasil dikirim.');
    } else {
      setErrorMessage(res.message || 'Gagal mengirim email tes.');
    }
  };

  const togglePasswordVisibility = (key: string) => {
    setShowPasswords((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const renderInput = (key: string, label: string, type: string = 'text', placeholder: string = '') => {
    const value = settings[key] || '';
    const isPassword = type === 'password';
    const show = showPasswords[key] || false;
    
    return (
      <div className="space-y-1" key={key}>
        <label className="block text-[11px] font-bold text-gray-500 uppercase">{label}</label>
        <div className="relative">
          <input
            type={isPassword && !show ? 'password' : type === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setSettingField(key, e.target.value)}
            placeholder={placeholder}
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs"
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => togglePasswordVisibility(key)}
              className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            >
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSelect = (key: string, label: string, options: { label: string; value: string }[]) => {
    const value = settings[key] || '';
    return (
      <div className="space-y-1" key={key}>
        <label className="block text-[11px] font-bold text-gray-500 uppercase">{label}</label>
        <select
          value={value}
          onChange={(e) => setSettingField(key, e.target.value)}
          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3.5 py-2.5 text-gray-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 text-xs"
        >
          <option value="">-- Pilih --</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>
    );
  };

  const renderToggle = (key: string, label: string, description: string) => {
    const value = settings[key] === 'true' || settings[key] === '1';
    return (
      <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100" key={key}>
        <div className="space-y-0.5">
          <span className="font-extrabold text-gray-900 block">{label}</span>
          <span className="text-gray-400 block text-[10px]">{description}</span>
        </div>
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => setSettingField(key, e.target.checked ? '1' : '0')}
          className="w-5 h-5 text-blue-600 border-gray-300 rounded-md focus:ring-blue-500 transition shrink-0 cursor-pointer"
        />
      </div>
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'General':
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Pengaturan Umum</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderInput('app_name', 'Website Name', 'text', 'GurkyNet')}
              {renderInput('company_name', 'Company Name', 'text', 'PT GurkyNet Global')}
              {renderInput('tagline', 'Tagline', 'text', 'Solusi Pembayaran Terbaik')}
              {renderSelect('timezone', 'Timezone', [
                { label: 'Asia/Jakarta (WIB)', value: 'Asia/Jakarta' },
                { label: 'Asia/Makassar (WITA)', value: 'Asia/Makassar' },
                { label: 'Asia/Jayapura (WIT)', value: 'Asia/Jayapura' },
              ])}
              {renderSelect('currency', 'Currency', [
                { label: 'IDR - Rupiah', value: 'IDR' },
                { label: 'USD - US Dollar', value: 'USD' },
              ])}
              {renderSelect('language', 'Language', [
                { label: 'Indonesia (id)', value: 'id' },
                { label: 'English (en)', value: 'en' },
              ])}
            </div>
            <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
              {renderToggle('maintenance_mode', 'Maintenance Mode', 'Aktifkan untuk menutup akses pengguna saat pemeliharaan sistem.')}
              {renderInput('maintenance_message', 'Maintenance Message', 'text', 'Sistem sedang dalam pemeliharaan rutin.')}
            </div>
          </div>
        );
      case 'Contact':
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Informasi Kontak</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderInput('contact_email', 'Support Email', 'email', 'support@gurkynet.com')}
              {renderInput('contact_phone', 'Support Phone', 'text', '+62 812 3456 7890')}
              {renderInput('contact_whatsapp', 'WhatsApp', 'text', '6281234567890')}
              <div className="sm:col-span-2">
                {renderInput('contact_address', 'Office Address', 'text', 'Jl. Alamat No.123, Jakarta')}
              </div>
              <div className="sm:col-span-2">
                {renderInput('contact_google_maps', 'Google Maps Embed URL', 'text', 'https://www.google.com/maps/embed?...')}
              </div>
            </div>
          </div>
        );
      case 'Social':
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Tautan Sosial Media</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderInput('social_facebook', 'Facebook URL')}
              {renderInput('social_instagram', 'Instagram URL')}
              {renderInput('social_tiktok', 'TikTok URL')}
              {renderInput('social_youtube', 'YouTube URL')}
              {renderInput('social_twitter', 'Twitter/X URL')}
            </div>
          </div>
        );
      case 'Email':
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Pengaturan SMTP Email</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderInput('email_smtp_host', 'SMTP Host')}
              {renderInput('email_smtp_port', 'SMTP Port', 'number')}
              {renderInput('email_smtp_username', 'SMTP Username')}
              {renderInput('email_smtp_password', 'SMTP Password', 'password')}
              {renderSelect('email_smtp_encryption', 'SMTP Encryption', [
                { label: 'None', value: 'none' },
                { label: 'TLS', value: 'tls' },
                { label: 'SSL', value: 'ssl' },
              ])}
              {renderInput('email_default_sender', 'Default Sender Email')}
            </div>
            
            <div className="mt-4 pt-4 border-t border-gray-100">
              <h4 className="font-bold text-xs text-gray-900 mb-2">Uji Pengiriman Email</h4>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="Masukkan email untuk dites..."
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 disabled:opacity-50"
                >
                  {testingEmail ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Test Email
                </button>
              </div>
            </div>
          </div>
        );
      case 'Payment':
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Pengaturan Payment Gateway (Midtrans)</h3>
            {renderToggle('payment_midtrans_enable', 'Enable Midtrans', 'Aktifkan metode pembayaran via Midtrans untuk deposit saldo pengguna.')}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
              {renderSelect('payment_midtrans_environment', 'Environment', [
                { label: 'Sandbox (Testing)', value: 'sandbox' },
                { label: 'Production (Live)', value: 'production' },
              ])}
              {renderInput('payment_midtrans_server_key', 'Server Key', 'password')}
              {renderInput('payment_midtrans_client_key', 'Client Key', 'password')}
            </div>
          </div>
        );
      case 'PPOB': {
        const vipBrand = (settings.ppob_vip_display_name || 'VIPAYMENT').trim() || 'VIPAYMENT';
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Pengaturan Product Provider PPOB</h3>
            
            {/* Digiflazz Section */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Digiflazz (Product Provider)</h4>
              {renderToggle('ppob_digiflazz_enable', 'Enable Digiflazz', 'Aktifkan Digiflazz sebagai product provider untuk katalog SKU PPOB.')}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {renderInput('ppob_digiflazz_username', 'Digiflazz Username')}
                {renderInput('ppob_digiflazz_api_key', 'API Key (Production / Dev)', 'password')}
                <div className="sm:col-span-2">
                  {renderInput('ppob_digiflazz_webhook_secret', 'Webhook Secret', 'password')}
                </div>
              </div>
            </div>

            {/* Configurable secondary product provider brand */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">{vipBrand} (Product Provider)</h4>
              {renderInput('ppob_vip_display_name', 'Brand Name Product Provider', 'text')}
              {renderToggle('ppob_vip_enable', `Enable ${vipBrand}`, `Aktifkan ${vipBrand} sebagai product provider sekunder/failover.`)}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {renderInput('ppob_vip_merchant_id', 'Merchant ID')}
                {renderInput('ppob_vip_api_key', 'API Key', 'password')}
                <div className="sm:col-span-2">
                  {renderInput('ppob_vip_signature', 'Secret / Signature', 'password')}
                </div>
              </div>
            </div>

            {/* Priority & Failover Strategy */}
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 space-y-3">
              <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Product Provider Routing & Failover</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderSelect('ppob_provider_priority', 'Primary Product Provider Priority', [
                  { label: 'Digiflazz First', value: 'digiflazz' },
                  { label: `${vipBrand} First`, value: 'vip' },
                ])}
                {renderSelect('ppob_failover_strategy', 'Failover Strategy', [
                  { label: 'Automatic Failover (Switch to Secondary on Error)', value: 'auto' },
                  { label: 'Manual Failover Only', value: 'manual' },
                  { label: 'Disable Product on Error', value: 'disable' },
                ])}
              </div>
            </div>
          </div>
        );
      }
      case 'Security':
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Pengaturan Keamanan</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {renderInput('security_max_login_attempts', 'Max Login Attempts', 'number', '5')}
              {renderInput('security_session_timeout', 'Session Timeout (Minutes)', 'number', '120')}
              {renderInput('security_otp_expiration', 'OTP Expiration (Minutes)', 'number', '5')}
              {renderSelect('security_password_policy', 'Password Policy', [
                { label: 'Standard (Min 8 chars)', value: 'standard' },
                { label: 'Strong (Mix chars, numbers, symbols)', value: 'strong' },
              ])}
            </div>
          </div>
        );
      case 'System':
        return (
          <div className="space-y-4">
            <h3 className="font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-2 mb-4">Informasi Sistem Backend</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="block text-[10px] text-gray-400 font-bold uppercase">PHP Version</span>
                <span className="block mt-1 font-mono text-sm font-bold text-gray-900">{systemStatus.php_version || '-'}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="block text-[10px] text-gray-400 font-bold uppercase">Laravel Version</span>
                <span className="block mt-1 font-mono text-sm font-bold text-gray-900">{systemStatus.laravel_version || '-'}</span>
              </div>
              <div className="p-3 bg-gray-50 rounded-xl border border-gray-200">
                <span className="block text-[10px] text-gray-400 font-bold uppercase">App Version</span>
                <span className="block mt-1 font-mono text-sm font-bold text-gray-900">{systemStatus.app_version || '-'}</span>
              </div>
              
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-emerald-600 font-bold uppercase">Queue Status</span>
                  <span className="block mt-1 text-sm font-bold text-emerald-800">{systemStatus.queue_status || 'Operational'}</span>
                </div>
                <Activity className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-blue-600 font-bold uppercase">Redis Status</span>
                  <span className="block mt-1 text-sm font-bold text-blue-800">{systemStatus.redis_status || 'Connected'}</span>
                </div>
                <Database className="w-5 h-5 text-blue-500" />
              </div>
              <div className="p-3 bg-purple-50 rounded-xl border border-purple-200 flex items-center justify-between">
                <div>
                  <span className="block text-[10px] text-purple-600 font-bold uppercase">Storage Status</span>
                  <span className="block mt-1 text-sm font-bold text-purple-800">{systemStatus.storage_status || 'Writable'}</span>
                </div>
                <Server className="w-5 h-5 text-purple-500" />
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-800 text-xs">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <p>Halaman ini menampilkan metrik sistem secara real-time dari server Laravel. Jika status Queue atau Redis menunjukkan "Disconnected" atau error, segera periksa log server.</p>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const tabs = [
    { id: 'General', label: 'General', icon: <Globe className="w-4 h-4" /> },
    { id: 'Contact', label: 'Contact', icon: <Phone className="w-4 h-4" /> },
    { id: 'Social', label: 'Social Media', icon: <Share2 className="w-4 h-4" /> },
    { id: 'Email', label: 'Email SMTP', icon: <Mail className="w-4 h-4" /> },
    { id: 'Payment', label: 'Payment (Midtrans)', icon: <CreditCard className="w-4 h-4" /> },
    { id: 'PPOB', label: 'PPOB Providers', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'Security', label: 'Security', icon: <Lock className="w-4 h-4" /> },
    { id: 'System', label: 'System Info', icon: <Cpu className="w-4 h-4" /> },
  ];

  const filteredTabs = tabs.filter(tab => tab.label.toLowerCase().includes(searchQuery.toLowerCase()) || tab.id.toLowerCase().includes(searchQuery.toLowerCase()));

  useEffect(() => {
    if (searchQuery && filteredTabs.length > 0 && !filteredTabs.find(t => t.id === activeTab)) {
      setActiveTab(filteredTabs[0].id);
    }
  }, [searchQuery, filteredTabs, activeTab]);

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 max-w-md bg-slate-900 text-white p-4 rounded-2xl shadow-2xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-bounce">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* HEADER BANNER */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl space-y-4 border border-slate-700">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-700 backdrop-blur-xs text-[11px] font-bold text-slate-200 border border-slate-600">
              <Settings className="w-3.5 h-3.5 text-slate-300" />
              System Settings Center
            </div>
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight">
              Global Configuration
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Pusat pengaturan sistem global GurkyNet. Anda dapat mengelola integrasi pihak ketiga, pengaturan SMTP, keamanan aplikasi, hingga detail kontak bisnis tanpa perlu memodifikasi berkas environtment server.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleReset}
              disabled={loading || saving}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-2xl font-black text-xs shadow-md transition flex items-center gap-2 border border-slate-600 disabled:opacity-50 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset</span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading || saving}
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs shadow-md transition flex items-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error callout if any API error occurs */}
      {(error || errorMessage) && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-900 flex items-start gap-3 shadow-xs">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h3 className="font-bold text-rose-950">Terjadi Kesalahan Respons API</h3>
            <p className="text-rose-800 leading-relaxed">{errorMessage || error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white p-12 rounded-3xl border border-gray-100 shadow-sm flex flex-col items-center justify-center space-y-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
          <div className="text-center">
            <p className="text-sm font-extrabold text-gray-900">Memuat Pengaturan...</p>
            <p className="text-xs text-gray-400">Menarik konfigurasi sistem dari basis data terenkripsi.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* TAB SIDEBAR */}
          <div className="lg:w-64 shrink-0 space-y-4">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari menu pengaturan..."
                className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-gray-800 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 shadow-sm"
              />
            </div>

            <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-3 flex flex-col gap-1">
              {filteredTabs.length > 0 ? filteredTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-50 text-blue-700 shadow-inner'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <div className={`${activeTab === tab.id ? 'text-blue-600' : 'text-gray-400'}`}>
                    {tab.icon}
                  </div>
                  {tab.label}
                </button>
              )) : (
                <div className="text-center p-4 text-gray-400 text-xs">
                  Menu tidak ditemukan.
                </div>
              )}
            </div>
          </div>

          {/* TAB CONTENT */}
          <div className="flex-1 bg-white rounded-3xl border border-gray-100 shadow-sm p-6 sm:p-8">
            {renderContent()}
          </div>
        </div>
      )}
    </div>
  );
};
