import React, { useState, useEffect } from 'react';
import { Settings, RefreshCw, Check, AlertCircle, Info, ShieldAlert, Image as ImageIcon, X } from 'lucide-react';
import { websiteService } from '../../services';
import { WebsiteSetting, Media } from '../../types';
import { CmsPageHeader, CmsSaveButton } from '../../components/common/CmsCommon';
import { MediaChooserModal } from '../../components/common/MediaChooserModal';
import { resolveMediaSrc } from '../../utils/mediaUrl';

export const MarketingWebsiteSettings: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Media Chooser Modal State
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [chooserKey, setChooserKey] = useState<'logo' | 'logoDark' | 'favicon' | null>(null);

  // Original fetched setting (to enable Reset)
  const [originalSetting, setOriginalSetting] = useState<WebsiteSetting | null>(null);

  // Current Form State
  const [formState, setFormState] = useState<Partial<WebsiteSetting>>({
    websiteName: '',
    tagline: '',
    logo: '',
    logoDark: '',
    favicon: '',
    supportEmail: '',
    supportPhone: '',
    whatsapp: '',
    officeAddress: '',
    googleMapsUrl: '',
    facebook: '',
    instagram: '',
    tiktok: '',
    youtube: '',
    twitter: '',
    copyright: '',
    maintenanceMode: false,
    timezone: 'Asia/Jakarta',
    currency: 'IDR',
    language: 'id',
  });

  const fetchSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await websiteService.getSettings();
      if (data && data.length > 0) {
        // Grab the latest record
        const latest = data[0];
        setOriginalSetting(latest);
        setFormState(latest);
      } else {
        // No settings exist yet, create a blank form state
        setOriginalSetting(null);
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat pengaturan website.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleReset = () => {
    if (originalSetting) {
      setFormState(originalSetting);
      setSuccess('Formulir diatur ulang ke konfigurasi tersimpan.');
    } else {
      setFormState({
        websiteName: '',
        tagline: '',
        logo: '',
        logoDark: '',
        favicon: '',
        supportEmail: '',
        supportPhone: '',
        whatsapp: '',
        officeAddress: '',
        googleMapsUrl: '',
        facebook: '',
        instagram: '',
        tiktok: '',
        youtube: '',
        twitter: '',
        copyright: '',
        maintenanceMode: false,
        timezone: 'Asia/Jakarta',
        currency: 'IDR',
        language: 'id',
      });
      setSuccess('Formulir diatur ulang ke nilai kosong.');
    }
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (originalSetting?.id) {
        // Update
        const updated = await websiteService.updateSetting(originalSetting.id, formState);
        setOriginalSetting(updated);
        setFormState(updated);
        setSuccess('Pengaturan website berhasil diperbarui!');
      } else {
        // Create
        const created = await websiteService.createSetting(formState);
        setOriginalSetting(created);
        setFormState(created);
        setSuccess('Pengaturan website baru berhasil dibuat!');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal menyimpan pengaturan website.');
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (key: keyof WebsiteSetting, value: any) => {
    setFormState((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const openMediaChooser = (key: 'logo' | 'logoDark' | 'favicon') => {
    setChooserKey(key);
    setIsChooserOpen(true);
  };

  const handleMediaSelect = (url: string, mediaItem?: Media) => {
    if (chooserKey) {
      setFormState((prev) => ({
        ...prev,
        [chooserKey]: url,
        [`${chooserKey}MediaId`]: mediaItem?.id,
        [`${chooserKey}Media`]: mediaItem,
      }));
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xs text-gray-500 font-medium">Memuat konfigurasi website...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12" id="website-settings-container">
      <CmsPageHeader
        title="Website Settings"
        subtitle="Kelola konfigurasi branding, informasi kontak, media sosial, dan status pemeliharaan portal utama."
        icon={Settings}
      />

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3 text-red-900 shadow-xs">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <span className="font-extrabold">Kesalahan:</span> {error}
          </div>
        </div>
      )}

      {success && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3 text-emerald-900 shadow-xs">
          <Check className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="text-xs font-bold">{success}</div>
        </div>
      )}

      <form onSubmit={handleSave} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Group inputs */}
        <div className="lg:col-span-2 space-y-6">
          {/* Section 1: Branding & Identitas */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-primary-600 rounded-full"></span>
              Branding & Identitas
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Nama Website <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={formState.websiteName || ''}
                  onChange={(e) => handleChange('websiteName', e.target.value)}
                  placeholder="e.g. GurkyNet PPOB"
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Tagline Website</label>
                <input
                  type="text"
                  value={formState.tagline || ''}
                  onChange={(e) => handleChange('tagline', e.target.value)}
                  placeholder="e.g. Layanan PPOB dan Pulsa Termurah"
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Logo Terang */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Logo (Terang)</label>
                {formState.logo ? (
                  <div className="relative group rounded-2xl border border-gray-100 p-2.5 bg-gray-50/50 flex items-center gap-3">
                    <img
                      src={resolveMediaSrc(formState.logo)}
                      alt="Logo Terang"
                      className="w-12 h-12 object-contain bg-white rounded-lg border border-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Terpilih</p>
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {formState.logoMedia?.filename || 'Logo Terang'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openMediaChooser('logo')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600 transition"
                        title="Ganti Logo"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormState((prev) => ({
                            ...prev,
                            logo: '',
                            logoMediaId: undefined,
                            logoMedia: undefined,
                          }));
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition"
                        title="Hapus Logo"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openMediaChooser('logo')}
                    className="w-full h-[68px] border-2 border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50/10 rounded-2xl flex flex-col items-center justify-center gap-1 transition group text-gray-500 hover:text-primary-600 cursor-pointer"
                  >
                    <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Pilih Logo</span>
                  </button>
                )}
              </div>

              {/* Logo Gelap */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Logo (Gelap)</label>
                {formState.logoDark ? (
                  <div className="relative group rounded-2xl border border-gray-100 p-2.5 bg-gray-50/50 flex items-center gap-3">
                    <img
                      src={resolveMediaSrc(formState.logoDark)}
                      alt="Logo Gelap"
                      className="w-12 h-12 object-contain bg-gray-950 rounded-lg border border-gray-800"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Terpilih</p>
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {formState.logoDarkMedia?.filename || 'Logo Gelap'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openMediaChooser('logoDark')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600 transition"
                        title="Ganti Logo Gelap"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormState((prev) => ({
                            ...prev,
                            logoDark: '',
                            logoDarkMediaId: undefined,
                            logoDarkMedia: undefined,
                          }));
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition"
                        title="Hapus Logo Gelap"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openMediaChooser('logoDark')}
                    className="w-full h-[68px] border-2 border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50/10 rounded-2xl flex flex-col items-center justify-center gap-1 transition group text-gray-500 hover:text-primary-600 cursor-pointer"
                  >
                    <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Pilih Logo Gelap</span>
                  </button>
                )}
              </div>

              {/* Favicon */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Favicon</label>
                {formState.favicon ? (
                  <div className="relative group rounded-2xl border border-gray-100 p-2.5 bg-gray-50/50 flex items-center gap-3">
                    <img
                      src={typeof formState.favicon === 'string' ? formState.favicon : formState.favicon?.url || ''}
                      alt="Favicon"
                      className="w-12 h-12 object-contain bg-white rounded-lg border border-gray-100"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider">Terpilih</p>
                      <p className="text-xs font-bold text-gray-800 truncate">
                        {formState.faviconMedia?.filename || 'Favicon'}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openMediaChooser('favicon')}
                        className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500 hover:text-primary-600 transition"
                        title="Ganti Favicon"
                      >
                        <ImageIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormState((prev) => ({
                            ...prev,
                            favicon: '',
                            faviconMediaId: undefined,
                            faviconMedia: undefined,
                          }));
                        }}
                        className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition"
                        title="Hapus Favicon"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => openMediaChooser('favicon')}
                    className="w-full h-[68px] border-2 border-dashed border-gray-200 hover:border-primary-500 hover:bg-primary-50/10 rounded-2xl flex flex-col items-center justify-center gap-1 transition group text-gray-500 hover:text-primary-600 cursor-pointer"
                  >
                    <ImageIcon className="w-5 h-5 text-gray-400 group-hover:text-primary-500 transition" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider">Pilih Favicon</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Informasi Kontak */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-primary-600 rounded-full"></span>
              Kontak Layanan
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Email Bantuan</label>
                <input
                  type="email"
                  value={formState.supportEmail || ''}
                  onChange={(e) => handleChange('supportEmail', e.target.value)}
                  placeholder="cs@gurkynet.my.id"
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Telepon Bantuan</label>
                <input
                  type="text"
                  value={formState.supportPhone || ''}
                  onChange={(e) => handleChange('supportPhone', e.target.value)}
                  placeholder="021-123456"
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">No. WhatsApp</label>
                <input
                  type="text"
                  value={formState.whatsapp || ''}
                  onChange={(e) => handleChange('whatsapp', e.target.value)}
                  placeholder="62812345678"
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Alamat Kantor</label>
              <textarea
                value={formState.officeAddress || ''}
                onChange={(e) => handleChange('officeAddress', e.target.value)}
                placeholder="Jl. Merdeka Raya No. 10, Jakarta Selatan"
                rows={2}
                className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-700">Google Maps Embed/Location URL</label>
              <input
                type="text"
                value={formState.googleMapsUrl || ''}
                onChange={(e) => handleChange('googleMapsUrl', e.target.value)}
                placeholder="https://maps.google.com/..."
                className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
              />
            </div>
          </div>

          {/* Section 3: Media Sosial */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-primary-600 rounded-full"></span>
              Jejaring Sosial
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Facebook URL</label>
                <input
                  type="text"
                  value={formState.facebook || ''}
                  onChange={(e) => handleChange('facebook', e.target.value)}
                  placeholder="https://facebook.com/..."
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Instagram URL</label>
                <input
                  type="text"
                  value={formState.instagram || ''}
                  onChange={(e) => handleChange('instagram', e.target.value)}
                  placeholder="https://instagram.com/..."
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">TikTok URL</label>
                <input
                  type="text"
                  value={formState.tiktok || ''}
                  onChange={(e) => handleChange('tiktok', e.target.value)}
                  placeholder="https://tiktok.com/..."
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">YouTube Channel URL</label>
                <input
                  type="text"
                  value={formState.youtube || ''}
                  onChange={(e) => handleChange('youtube', e.target.value)}
                  placeholder="https://youtube.com/..."
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Twitter / X URL</label>
                <input
                  type="text"
                  value={formState.twitter || ''}
                  onChange={(e) => handleChange('twitter', e.target.value)}
                  placeholder="https://x.com/..."
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Hak Cipta / Copyright</label>
                <input
                  type="text"
                  value={formState.copyright || ''}
                  onChange={(e) => handleChange('copyright', e.target.value)}
                  placeholder="e.g. © 2026 GurkyNet. All rights reserved."
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl px-3.5 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Sidebar settings */}
        <div className="space-y-6">
          {/* Section 4: Maintenance Status & Security */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h2 className="text-sm font-black text-gray-900 border-b border-gray-100 pb-2 flex items-center gap-2">
              <span className="w-1.5 h-3 bg-red-600 rounded-full"></span>
              Sistem & Keamanan
            </h2>

            {/* Maintenance Mode Toggle */}
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200/60 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-amber-950 font-black text-xs">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>Maintenance Mode</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.maintenanceMode || false}
                    onChange={(e) => handleChange('maintenanceMode', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                Aktifkan mode pemeliharaan untuk memblokir akses publik ke website dan menampilkan halaman maintenance.
              </p>
            </div>

            {/* Timezone & Localization */}
            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Zona Waktu (Timezone)</label>
                <select
                  value={formState.timezone || 'Asia/Jakarta'}
                  onChange={(e) => handleChange('timezone', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
                >
                  <option value="Asia/Jakarta">WIB (Asia/Jakarta)</option>
                  <option value="Asia/Makassar">WITA (Asia/Makassar)</option>
                  <option value="Asia/Jayapura">WIT (Asia/Jayapura)</option>
                  <option value="UTC">UTC / GMT</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Mata Uang Default</label>
                <select
                  value={formState.currency || 'IDR'}
                  onChange={(e) => handleChange('currency', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
                >
                  <option value="IDR">Rupiah (IDR)</option>
                  <option value="USD">US Dollar (USD)</option>
                  <option value="SGD">Singapore Dollar (SGD)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-700">Bahasa Website</label>
                <select
                  value={formState.language || 'id'}
                  onChange={(e) => handleChange('language', e.target.value)}
                  className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 rounded-xl px-3.5 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
                >
                  <option value="id">Bahasa Indonesia (ID)</option>
                  <option value="en">English (EN)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Form Actions Card */}
          <div className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm space-y-4">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-wider">Aksi Konfigurasi</h3>
            <div className="flex flex-col gap-2">
              <CmsSaveButton label="Simpan Perubahan" isLoading={saving} />
              <button
                type="button"
                onClick={handleReset}
                className="w-full py-3 bg-gray-50 hover:bg-gray-100 text-gray-600 hover:text-gray-900 rounded-2xl font-bold text-xs border border-gray-100 transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Atur Ulang / Reset</span>
              </button>
            </div>

            <div className="p-3 bg-blue-50/50 rounded-2xl border border-blue-100/50 flex gap-2.5">
              <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-[10px] text-blue-800 leading-normal font-medium">
                Perubahan pada data ini akan langsung merubah konfigurasi publik sistem secara tersentralisasi.
              </p>
            </div>
          </div>
        </div>
      </form>
      <MediaChooserModal
        isOpen={isChooserOpen}
        onClose={() => setIsChooserOpen(false)}
        onSelect={handleMediaSelect}
        allowedFolder={chooserKey || undefined}
      />
    </div>
  );
};

