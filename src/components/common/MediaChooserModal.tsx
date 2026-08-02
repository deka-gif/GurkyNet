import React, { useState, useEffect } from 'react';
import { Search, Folder, Image as ImageIcon, Upload, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { useMediaStore } from '../../store/media.store';
import { Media } from '../../types';

interface MediaChooserModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, mediaItem?: Media) => void;
  allowedFolder?: string;
  title?: string;
}

export const MediaChooserModal = ({
  isOpen,
  onClose,
  onSelect,
  allowedFolder = '',
  title = 'Pilih Media'
}: MediaChooserModalProps) => {
  const { items, loading, error, filters, setFilters, fetchMedia, uploadMedia } = useMediaStore();
  const [selectedItem, setSelectedItem] = useState<Media | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFolder, setActiveFolder] = useState(allowedFolder);
  
  // Upload state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [altText, setAltText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFilters({ 
        keyword: searchQuery, 
        folder: activeFolder,
        per_page: 20, // larger list for chooser
        page: 1 
      });
      fetchMedia(true);
    }
  }, [isOpen, searchQuery, activeFolder]);

  if (!isOpen) return null;

  const foldersList = [
    { value: '', label: 'Semua Folder' },
    { value: 'logo', label: 'Logo' },
    { value: 'favicon', label: 'Favicon' },
    { value: 'banner', label: 'Banner' },
    { value: 'promotion', label: 'Promosi' },
    { value: 'static-page', label: 'Halaman Statis' },
    { value: 'general', label: 'Umum' }
  ];

  const handleSelect = () => {
    if (selectedItem) {
      onSelect(selectedItem.url, selectedItem);
      onClose();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploadFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleDirectUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploading(true);
    setUploadError(null);

    try {
      const folderToUse = activeFolder || 'general';
      const uploadedItem = await uploadMedia(uploadFile, {
        altText: altText || uploadFile.name.split('.')[0],
        folder: folderToUse
      });
      
      // Auto-select the newly uploaded file!
      setSelectedItem(uploadedItem);
      setUploadFile(null);
      setAltText('');
    } catch (err: any) {
      setUploadError(err.message || 'Gagal mengunggah berkas.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div className="bg-white rounded-3xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden shadow-2xl border border-gray-100">
        
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-extrabold text-gray-900">{title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">Pilih atau unggah gambar langsung ke CMS Media Library</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Main Content Container */}
        <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
          
          {/* Left panel: Media listing & search */}
          <div className="flex-1 flex flex-col p-6 min-h-0 overflow-hidden border-r border-gray-50">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              {/* Search Bar */}
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Cari media..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all"
                />
              </div>

              {/* Folder tab selector */}
              <div className="flex gap-1 overflow-x-auto pb-1 max-w-full sm:max-w-xs md:max-w-md">
                <select
                  value={activeFolder}
                  onChange={(e) => setActiveFolder(e.target.value)}
                  className="px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 focus:bg-white outline-none transition-all cursor-pointer"
                >
                  {foldersList.map((f) => (
                    <option key={f.value} value={f.value}>{f.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Error State */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 rounded-xl flex items-start gap-2 text-red-700 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Media Grid / List */}
            <div className="flex-1 overflow-y-auto pr-1">
              {loading ? (
                <div className="h-full flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                  <p className="text-sm font-medium text-gray-500">Memuat berkas media...</p>
                </div>
              ) : items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-gray-100 rounded-2xl">
                  <div className="w-12 h-12 bg-gray-50 text-gray-400 rounded-full flex items-center justify-center mb-3">
                    <ImageIcon className="w-6 h-6" />
                  </div>
                  <h4 className="font-bold text-gray-800 text-sm">Tidak Ada Media</h4>
                  <p className="text-xs text-gray-400 max-w-xs mt-1">Belum ada gambar yang diunggah di folder ini atau tidak cocok dengan pencarian Anda.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {items.map((media) => {
                    const isSelected = selectedItem?.id === media.id;
                    return (
                      <button
                        key={media.id}
                        type="button"
                        onClick={() => setSelectedItem(media)}
                        onDoubleClick={() => {
                          setSelectedItem(media);
                          onSelect(media.url, media);
                          onClose();
                        }}
                        className={`group relative aspect-square border-2 rounded-2xl overflow-hidden bg-gray-50 text-left transition-all outline-none ${isSelected ? 'border-primary-500 ring-4 ring-primary-500/10 scale-[0.98]' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <img
                          src={media.url}
                          alt={media.altText || media.filename}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2.5">
                          <p className="text-white text-[10px] font-bold truncate">{media.filename}</p>
                          <p className="text-gray-200 text-[8px]">{media.width}x{media.height} • {media.extension.toUpperCase()}</p>
                        </div>
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-primary-500 text-white rounded-full flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                        <span className="absolute bottom-2 left-2 bg-black/50 backdrop-blur-xs text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md uppercase">
                          {media.folder}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right panel: File upload or selected details */}
          <div className="w-full md:w-72 border-t md:border-t-0 border-l border-gray-100 bg-gray-50/50 p-6 flex flex-col gap-6 overflow-y-auto">
            
            {/* DIRECT UPLOAD BOX */}
            <div className="bg-white border border-gray-100 rounded-2xl p-4 shadow-xs">
              <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Upload className="w-3.5 h-3.5 text-primary-500" />
                <span>Unggah Cepat</span>
              </h4>
              
              <form onSubmit={handleDirectUpload} className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Pilih File</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-xs text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100 cursor-pointer"
                  />
                  <p className="text-[10px] text-gray-400 mt-1">Maks. 5MB (JPG, PNG, WebP, SVG)</p>
                </div>

                {uploadFile && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1">Alt Text (Deskripsi)</label>
                      <input
                        type="text"
                        placeholder="Deskripsi gambar"
                        value={altText}
                        onChange={(e) => setAltText(e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500/10 focus:border-primary-500 outline-none"
                      />
                    </div>

                    {uploadError && (
                      <div className="text-[10px] text-red-600 font-semibold leading-relaxed">
                        {uploadError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={uploading}
                      className="w-full bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Mengunggah...</span>
                        </>
                      ) : (
                        <>
                          <Upload className="w-3.5 h-3.5" />
                          <span>Unggah Sekarang</span>
                        </>
                      )}
                    </button>
                  </>
                )}
              </form>
            </div>

            {/* SELECTION DETAIL */}
            <div className="flex-1 flex flex-col justify-between">
              {selectedItem ? (
                <div className="space-y-4">
                  <h4 className="font-extrabold text-xs text-gray-900 uppercase tracking-wider">Detail Terpilih</h4>
                  
                  <div className="aspect-video bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                    <img
                      src={selectedItem.url}
                      alt={selectedItem.altText}
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  
                  <div className="space-y-2.5 text-xs text-gray-600">
                    <div className="truncate" title={selectedItem.filename}>
                      <span className="font-bold text-gray-900">Nama:</span> {selectedItem.filename}
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">Ukuran:</span> {(selectedItem.size / 1024).toFixed(1)} KB
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">Dimensi:</span> {selectedItem.width} x {selectedItem.height} px
                    </div>
                    <div>
                      <span className="font-bold text-gray-900">Folder:</span> <span className="bg-gray-100 text-gray-700 font-bold px-1.5 py-0.5 rounded uppercase text-[9px]">{selectedItem.folder}</span>
                    </div>
                    {selectedItem.altText && (
                      <div className="italic text-gray-500 mt-1">
                        "{selectedItem.altText}"
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 text-xs p-4">
                  <ImageIcon className="w-8 h-8 text-gray-300 mb-2" />
                  <p>Pilih berkas dari galeri sebelah kiri atau unggah file baru untuk melengkapi.</p>
                </div>
              )}

              {/* Action Actions */}
              <div className="pt-4 border-t border-gray-100 flex gap-2.5 mt-auto">
                <button
                  onClick={onClose}
                  className="flex-1 border border-gray-200 hover:bg-gray-50 text-gray-700 font-bold py-2.5 rounded-xl text-center text-xs transition-colors cursor-pointer"
                >
                  Batal
                </button>
                <button
                  onClick={handleSelect}
                  disabled={!selectedItem}
                  className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white font-bold py-2.5 rounded-xl text-center text-xs transition-all shadow-md shadow-primary-500/10 cursor-pointer disabled:cursor-not-allowed"
                >
                  Pilih Media
                </button>
              </div>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
