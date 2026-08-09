import { useAuth } from './useAuth';

/**
 * Sprint 2 Revision — Frontend Alignment (SRS Bagian 5 & 13.1).
 *
 * Owner memiliki akses "Lihat (V)" / read-only pada modul Finance,
 * Operations, Marketing, dan Customer Support. Backend sudah menegakkan
 * ini lewat middleware `EnsureOwnerReadOnly` (menolak semua request
 * non-GET/HEAD dari Owner pada modul-modul tersebut dengan 403).
 *
 * Hook ini dipakai di UI untuk menyembunyikan/menonaktifkan kontrol
 * tulis (Tambah/Edit/Hapus/Approve/Reject/Publish/dll.) khusus untuk role
 * Owner, sesuai SRS 13.1: "Menu yang aksesnya 'Lihat (V)' saja tetap
 * ditampilkan tapi tombol edit/hapus disembunyikan."
 *
 * Tidak mengubah perilaku role lain (Super Admin, Finance, Operations,
 * Marketing, Customer Support) — hanya role 'Owner' yang di-flag di sini.
 */
export function useOwnerReadOnly(): boolean {
  const { user } = useAuth();
  return user?.role === 'Owner';
}
