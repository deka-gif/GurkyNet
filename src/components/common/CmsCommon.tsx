import React from 'react';
import { motion } from 'motion/react';
import { Search, RotateCcw, Plus, Trash2, Save, CheckCircle, FileText, AlertTriangle } from 'lucide-react';

// ==========================================
// 1. PAGE HEADER
// ==========================================
interface PageHeaderProps {
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ComponentType<{ className?: string }>;
  };
}

export const CmsPageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, icon: Icon, action }) => {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-primary-50 text-primary-600 flex items-center justify-center shadow-xs">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">{title}</h1>
          <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{subtitle}</p>
        </div>
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-2xl font-bold text-xs shadow-lg shadow-primary-500/10 transition-all flex items-center justify-center gap-2 self-start md:self-auto"
        >
          {action.icon ? (
            React.createElement(action.icon, { className: 'w-4 h-4' })
          ) : (
            <Plus className="w-4 h-4" />
          )}
          <span>{action.label}</span>
        </button>
      )}
    </div>
  );
};

// ==========================================
// 2. FILTER BAR
// ==========================================
interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (val: string) => void;
  searchPlaceholder?: string;
  filters?: {
    label: string;
    value: string;
    onChange: (val: string) => void;
    options: { label: string; value: string }[];
  }[];
  onReset?: () => void;
}

export const CmsFilterBar: React.FC<FilterBarProps> = ({
  searchQuery,
  onSearchChange,
  searchPlaceholder = 'Cari...',
  filters = [],
  onReset,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col md:flex-row md:items-center gap-3 mb-6">
      <div className="relative flex-1">
        <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full bg-gray-50 border border-gray-100 focus:bg-white focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10 rounded-xl pl-10 pr-4 py-2.5 text-xs text-gray-900 outline-none transition-all placeholder-gray-400 font-medium"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {filters.map((filter, idx) => (
          <div key={idx} className="flex items-center gap-1.5 min-w-[120px]">
            <select
              value={filter.value}
              onChange={(e) => filter.onChange(e.target.value)}
              className="w-full bg-gray-50 border border-gray-100 hover:border-gray-200 focus:bg-white focus:border-primary-500 rounded-xl px-3 py-2.5 text-xs text-gray-700 font-bold outline-none transition-all cursor-pointer"
            >
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        ))}

        {onReset && (
          <button
            onClick={onReset}
            className="p-2.5 bg-gray-50 hover:bg-gray-100 text-gray-500 hover:text-gray-900 rounded-xl border border-gray-100 hover:border-gray-200 transition-colors flex items-center gap-1.5 text-xs font-bold"
            title="Reset filter"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. STATUS BADGE
// ==========================================
interface StatusBadgeProps {
  visible?: boolean;
  status?: string;
}

export const CmsStatusBadge: React.FC<StatusBadgeProps> = ({ visible, status }) => {
  if (visible !== undefined) {
    return visible ? (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
        <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse"></span>
        Aktif
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-gray-50 text-gray-500 border border-gray-100">
        <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
        Nonaktif
      </span>
    );
  }

  const s = String(status || '').toLowerCase();
  if (s === 'active' || s === 'aktif' || s === 'published') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
        <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full animate-pulse"></span>
        Published
      </span>
    );
  }

  if (s === 'draft' || s === 'draf') {
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-600 border border-amber-100">
        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
        Draft
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-gray-50 text-gray-500 border border-gray-100">
      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full"></span>
      {status}
    </span>
  );
};

// ==========================================
// 4. DELETE CONFIRMATION MODAL
// ==========================================
interface DeleteConfirmationProps {
  isOpen: boolean;
  title?: string;
  description?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export const CmsDeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  isOpen,
  title = 'Hapus Item',
  description = 'Apakah Anda yakin ingin menghapus item ini? Tindakan ini tidak dapat dibatalkan.',
  onConfirm,
  onCancel,
  isLoading = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white max-w-sm w-full rounded-3xl p-6 shadow-2xl border border-gray-100 text-center space-y-4 animate-in zoom-in-95"
      >
        <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
          <Trash2 className="w-5 h-5" />
        </div>

        <div className="space-y-1">
          <h3 className="font-extrabold text-gray-900 text-base">{title}</h3>
          <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-2.5 rounded-xl text-xs transition"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-lg shadow-red-600/10 transition flex items-center justify-center gap-1.5"
          >
            {isLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
            <span>Hapus</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
};

// ==========================================
// 5. SAVE BUTTON
// ==========================================
interface SaveButtonProps {
  isLoading?: boolean;
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
  type?: 'button' | 'submit';
}

export const CmsSaveButton: React.FC<SaveButtonProps> = ({
  isLoading = false,
  disabled = false,
  label = 'Simpan Perubahan',
  onClick,
  type = 'submit',
}) => {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isLoading || disabled}
      className={`px-5 py-3 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-200 text-white disabled:text-gray-400 rounded-2xl font-bold text-xs shadow-lg shadow-primary-500/10 hover:shadow-primary-500/15 transition-all flex items-center justify-center gap-2`}
    >
      {isLoading ? (
        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
      ) : (
        <Save className="w-4 h-4" />
      )}
      <span>{label}</span>
    </button>
  );
};

// ==========================================
// 6. PUBLISH BADGE
// ==========================================
interface PublishBadgeProps {
  status: 'draft' | 'published';
}

export const CmsPublishBadge: React.FC<PublishBadgeProps> = ({ status }) => {
  return status === 'published' ? (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-100">
      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
      Published
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-50 text-amber-700 border border-amber-100">
      <FileText className="w-3.5 h-3.5 text-amber-600" />
      Draft
    </span>
  );
};
