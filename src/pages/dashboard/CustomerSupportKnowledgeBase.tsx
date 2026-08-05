import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Search,
  BookOpen,
  Pin,
  Clock,
  User,
  ArrowLeft,
  ChevronRight,
  Ticket,
  Receipt,
  Search as SearchIcon,
  Layers,
  X,
  RefreshCw,
  Loader2
} from 'lucide-react';

import { useCustomerSupportStore, KBArticle } from '../../store/customerSupport.store';

// Categories List
const categories = [
  'General',
  'Account',
  'Wallet',
  'Transaction',
  'Digiflazz',
  'Midtrans',
  'Refund',
  'Security',
  'FAQ',
  'Announcements'
] as const;

export const CustomerSupportKnowledgeBase: React.FC = () => {
  const navigate = useNavigate();

  const { kbArticles, kbArticlesLoading, fetchKbArticles } = useCustomerSupportStore();

  useEffect(() => {
    fetchKbArticles();
  }, [fetchKbArticles]);

  // Search and Category Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  
  // Selected Article for Detail View
  const [activeArticle, setActiveArticle] = useState<KBArticle | null>(null);

  // Popular Searches options
  const popularSearches = ['Top Up Failed', 'Refund', 'Payment Pending', 'Digiflazz Error', 'Wallet'];

  // Active articles source — real API data only, no seeded fallback articles.
  const activeKbList: KBArticle[] = useMemo(
    () => (Array.isArray(kbArticles) ? kbArticles : []),
    [kbArticles]
  );

  // Filtered Articles List
  const filteredArticles = useMemo(() => {
    const q = (searchQuery ?? '').toLowerCase().trim();
    return activeKbList.filter((art) => {
      const category = (art.category ?? 'General').toString();
      const matchCategory = selectedCategory === 'All' || category.toLowerCase() === selectedCategory.toLowerCase();

      if (!matchCategory) return false;
      if (!q) return true;

      const title = (art.title ?? art.question ?? '').toString().toLowerCase();
      const shortDescription = (art.shortDescription ?? art.content ?? art.answer ?? '').toString().toLowerCase();
      const id = (art.id ?? '').toString().toLowerCase();
      const matchTags = Array.isArray(art.tags) && art.tags.some((t: any) => (t ?? '').toString().toLowerCase().includes(q));

      return (
        title.includes(q) ||
        shortDescription.includes(q) ||
        id.includes(q) ||
        matchTags
      );
    });
  }, [activeKbList, searchQuery, selectedCategory]);

  // Pinned Articles (Top 5)
  const pinnedArticles = useMemo(() => activeKbList.filter((a) => a.isPinned).slice(0, 5), [activeKbList]);

  // Recently Updated Articles (Latest 5)
  const recentlyUpdatedArticles = useMemo(
    () => [...activeKbList].sort((a, b) => (b.lastUpdated || '').localeCompare(a.lastUpdated || '')).slice(0, 5),
    [activeKbList]
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard/customer-support/tickets')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-blue-600 bg-white px-3.5 py-2 rounded-xl border border-gray-200 shadow-xs transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Kembali ke Support Dashboard
        </button>
        <span className="text-xs font-mono text-gray-400">CS Knowledge Base & Internal SOP Portal</span>
      </div>

      {/* QUICK LINKS BUTTONS */}
      <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Support Quick Links</div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/dashboard/customer-support/tickets"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Ticket className="w-4 h-4" />
            <span>Open Ticket</span>
          </Link>

          <Link
            to="/dashboard/customer-support/refund-center"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Receipt className="w-4 h-4" />
            <span>Refund Center</span>
          </Link>

          <Link
            to="/dashboard/customer-support/investigation"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <SearchIcon className="w-4 h-4" />
            <span>Transaction Investigation</span>
          </Link>

          <Link
            to="/dashboard/customer-support/customer-profile"
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200 rounded-xl text-xs font-semibold transition"
          >
            <User className="w-4 h-4 text-gray-500" />
            <span>Customer Profile</span>
          </Link>
        </div>
      </div>

      {/* GLOBAL SEARCH SECTION */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 sm:p-8 text-white shadow-md space-y-4">
        <div className="max-w-2xl space-y-2">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[11px] font-semibold text-blue-100">
            <BookOpen className="w-3.5 h-3.5" />
            Internal SOP Repository
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Pusat Pengetahuan & Panduan SOP Customer Support
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 leading-relaxed">
            Cari dokumen standar operasional prosedur (SOP), panduan penanganan kendala transaksi, dan informasi sistem terbaru.
          </p>
        </div>

        {/* Global Search Bar */}
        <div className="relative max-w-2xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari kata kunci artikel, nomor SOP, Digiflazz, Midtrans, Refund..."
            className="w-full pl-12 pr-10 py-3.5 bg-white text-gray-900 rounded-2xl text-xs sm:text-sm font-medium shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Popular Searches */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="text-blue-200 font-medium text-[11px]">Popular Searches:</span>
          {popularSearches.map((term) => (
            <button
              key={term}
              onClick={() => setSearchQuery(term)}
              className="px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-lg text-blue-50 font-medium transition text-[11px]"
            >
              {term}
            </button>
          ))}
        </div>
      </div>

      {/* CONDITIONAL ARTICLE DETAIL VIEW OR MAIN LAYOUT */}
      {activeArticle ? (
        /* ARTICLE DETAIL VIEWER */
        <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-gray-100 space-y-6">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs text-gray-500 border-b border-gray-100 pb-3">
            <button onClick={() => setActiveArticle(null)} className="hover:text-blue-600 font-semibold flex items-center gap-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Knowledge Base
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-gray-400">{activeArticle.category || 'General'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
            <span className="font-mono font-bold text-gray-800">{activeArticle.id ? String(activeArticle.id) : ''}</span>
          </div>

          {/* Article Header */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100">
                {activeArticle.category || 'General'}
              </span>
              <span className="px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-xs font-mono font-bold">
                {activeArticle.id ? String(activeArticle.id) : ''}
              </span>
              {activeArticle.isPinned && (
                <span className="px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 text-xs font-bold flex items-center gap-1 border border-amber-200">
                  <Pin className="w-3 h-3" /> Pinned SOP
                </span>
              )}
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-snug">
              {activeArticle.title || activeArticle.question || 'Artikel Knowledge Base'}
            </h1>

            {/* Metadata Ribbon */}
            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pt-2 border-t border-gray-100">
              <div className="flex items-center gap-1.5">
                <User className="w-4 h-4 text-gray-400" />
                <span>Penulis: <strong className="text-gray-800">{activeArticle.author || 'Tim CS GurkyNet'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-gray-400" />
                <span>Waktu Baca: <strong className="text-gray-800">{activeArticle.readingTime || '2m'}</strong></span>
              </div>
              <div className="flex items-center gap-1.5">
                <RefreshCw className="w-4 h-4 text-gray-400" />
                <span>Terakhir Diperbarui: <strong className="text-gray-800">{activeArticle.lastUpdated || activeArticle.updated_at || 'Terbaru'}</strong></span>
              </div>
            </div>
          </div>

          {/* Article Content Box */}
          <div className="p-5 sm:p-6 bg-gray-50/70 rounded-2xl border border-gray-100 text-xs sm:text-sm text-gray-800 leading-relaxed space-y-4 whitespace-pre-line font-sans">
            {activeArticle.content || activeArticle.answer || activeArticle.shortDescription || '-'}
          </div>

          {/* Article Tags */}
          {Array.isArray(activeArticle.tags) && activeArticle.tags.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <span className="text-xs font-bold text-gray-400 uppercase">Tags:</span>
              {activeArticle.tags.map((tag: any) => (
                <span key={String(tag)} className="px-2.5 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-mono">
                  #{String(tag)}
                </span>
              ))}
            </div>
          )}

          {/* Footer Action */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-100">
            <button
              onClick={() => setActiveArticle(null)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-semibold transition"
            >
              ← Kembali ke Daftar Artikel
            </button>
            <div className="text-xs text-gray-400">Dokumen Resmi Internal GurkyNet Support</div>
          </div>
        </div>
      ) : (
        /* MAIN CONTENT GRID (LEFT SIDEBAR + MAIN CONTENT) */
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* LEFT SIDEBAR CATEGORIES (1/4 width) */}
          <div className="space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-3">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">Categories</div>

              <div className="space-y-1">
                <button
                  onClick={() => setSelectedCategory('All')}
                  className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition ${
                    selectedCategory === 'All'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4" />
                    <span>Semua Kategori</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-white/20 font-mono">
                    {activeKbList.length}
                  </span>
                </button>

                {categories.map((cat) => {
                  const count = activeKbList.filter((a) => (a.category ?? 'General').toString().toLowerCase() === cat.toLowerCase()).length;
                  const isSelected = selectedCategory === cat;

                  return (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-medium transition ${
                        isSelected
                          ? 'bg-blue-600 text-white font-bold shadow-xs'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate">{cat}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* PINNED ARTICLES SIDEBAR SECTION */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
                <Pin className="w-4 h-4 text-amber-500" />
                <span>Top 5 Frequently Used SOP</span>
              </div>

              <div className="space-y-2">
                {pinnedArticles.map((art) => (
                  <button
                    key={String(art.id)}
                    onClick={() => setActiveArticle(art)}
                    className="w-full text-left p-2.5 bg-gray-50 hover:bg-amber-50/60 rounded-xl border border-gray-100 space-y-1 transition group"
                  >
                    <div className="text-xs font-bold text-gray-900 group-hover:text-amber-900 line-clamp-2">
                      {art.title || art.question || 'Artikel SOP'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{art.category || 'General'}</span>
                      <span className="font-mono">{art.readingTime || '2m'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* RECENTLY UPDATED SIDEBAR SECTION */}
            <div className="bg-white p-4 rounded-2xl shadow-xs border border-gray-100 space-y-3">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900 border-b border-gray-100 pb-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <span>Recently Updated SOP</span>
              </div>

              <div className="space-y-2">
                {recentlyUpdatedArticles.map((art) => (
                  <button
                    key={String(art.id)}
                    onClick={() => setActiveArticle(art)}
                    className="w-full text-left p-2.5 bg-gray-50 hover:bg-blue-50/60 rounded-xl border border-gray-100 space-y-1 transition group"
                  >
                    <div className="text-xs font-bold text-gray-900 group-hover:text-blue-700 line-clamp-1">
                      {art.title || art.question || 'Artikel SOP'}
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-gray-400">
                      <span>{art.category || 'General'}</span>
                      <span className="font-mono">{art.lastUpdated || art.updated_at || 'Terbaru'}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* MAIN ARTICLES GRID (3/4 width) */}
          <div className="lg:col-span-3 space-y-4">
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-xs border border-gray-100">
              <div className="text-xs font-bold text-gray-900">
                Kategori: <span className="text-blue-600">{selectedCategory}</span>
              </div>
              <div className="text-xs text-gray-500">
                Menampilkan <strong className="text-gray-900">{filteredArticles.length}</strong> artikel SOP
              </div>
            </div>

            {/* ARTICLES CARDS GRID */}
            {kbArticlesLoading ? (
              <div className="bg-white p-12 text-center rounded-2xl border border-gray-100">
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin mx-auto mb-2" />
                <span className="text-xs text-gray-500">Memuat artikel SOP...</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredArticles.length > 0 ? (
                  filteredArticles.map((art) => (
                    <div
                      key={String(art.id)}
                      onClick={() => setActiveArticle(art)}
                      className="bg-white p-5 rounded-2xl shadow-xs border border-gray-100 hover:border-blue-300 hover:shadow-md transition cursor-pointer flex flex-col justify-between space-y-3 group"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="px-2.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold border border-blue-100">
                            {art.category || 'General'}
                          </span>
                          <span className="text-[10px] font-mono text-gray-400">{art.id ? String(art.id) : ''}</span>
                        </div>

                        <h3 className="text-sm font-bold text-gray-900 group-hover:text-blue-600 transition leading-snug line-clamp-2">
                          {art.title || art.question || 'Artikel Knowledge Base'}
                        </h3>

                        <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                          {art.shortDescription || art.content || art.answer || '-'}
                        </p>
                      </div>

                      <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                        <div className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[100px] sm:max-w-[120px]">{art.author || 'Tim CS GurkyNet'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono">{art.readingTime || '2m'}</span>
                          <span>•</span>
                          <span>{art.lastUpdated || art.updated_at || 'Terbaru'}</span>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-2 bg-white p-12 text-center rounded-2xl border border-gray-100 text-gray-400 space-y-2">
                    <BookOpen className="w-8 h-8 mx-auto text-gray-300" />
                    <div className="text-sm font-bold text-gray-600">Tidak Ada Artikel Ditemukan</div>
                    <p className="text-xs">Coba ubah kata kunci pencarian atau pilih kategori lain.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
