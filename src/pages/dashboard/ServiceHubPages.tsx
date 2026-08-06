import {
  Smartphone,
  Wifi,
  MessageSquare,
  Clock,
  Nfc,
  Zap,
  Droplets,
  Heart,
  Briefcase,
  Tv,
  Flame,
  Home,
  Car,
  Landmark,
  Receipt,
} from 'lucide-react';
import { ServiceHubPage } from '../../components/catalog/ServiceHubPage';

export const TelekomunikasiHubPage = () => (
  <ServiceHubPage
    title="Telekomunikasi"
    subtitle="Pulsa, paket data, voucher internet, SMS, masa aktif, perdana, dan eSIM dari katalog provider."
    children={[
      { key: 'pulsa', label: 'Pulsa', description: 'Isi pulsa semua operator', path: '/dashboard/pulsa', icon: Smartphone },
      { key: 'data', label: 'Paket Data', description: 'Kuota internet', path: '/dashboard/paket-data', icon: Wifi },
      { key: 'voucher-internet', label: 'Voucher Internet', description: 'Tembak / e-voucher / fisik', path: '/dashboard/voucher-internet', icon: Wifi },
      { key: 'sms-telepon', label: 'Paket SMS & Telepon', description: 'Paket nelpon & SMS', path: '/dashboard/telekomunikasi/sms-telepon', icon: MessageSquare },
      { key: 'masa-aktif', label: 'Masa Aktif', description: 'Perpanjang masa aktif', path: '/dashboard/telekomunikasi/masa-aktif', icon: Clock },
      { key: 'aktivasi-perdana', label: 'Aktivasi Perdana', description: 'Aktivasi kartu perdana', path: '/dashboard/telekomunikasi/aktivasi-perdana', icon: Nfc },
      { key: 'esim', label: 'eSIM', description: 'Produk eSIM', path: '/dashboard/telekomunikasi/esim', icon: Nfc },
    ]}
  />
);

export const TagihanHubPage = () => (
  <ServiceHubPage
    title="Pembayaran Tagihan"
    subtitle="Token PLN, pascabayar, PDAM, BPJS, internet, TV, gas, PBB, SAMSAT, dan multifinance."
    children={[
      { key: 'pln', label: 'Token PLN', description: 'Token listrik prabayar', path: '/dashboard/token-pln', icon: Zap },
      { key: 'pln-pascabayar', label: 'PLN Pascabayar', description: 'Tagihan listrik pasca', path: '/dashboard/tagihan/pln-pascabayar', icon: Zap },
      { key: 'pdam', label: 'PDAM', description: 'Tagihan air', path: '/dashboard/tagihan/pdam', icon: Droplets },
      { key: 'bpjs-kesehatan', label: 'BPJS Kesehatan', description: 'Iuran BPJS Kes', path: '/dashboard/tagihan/bpjs-kesehatan', icon: Heart },
      { key: 'bpjs-tk', label: 'BPJS Ketenagakerjaan', description: 'Iuran BPJS TK', path: '/dashboard/tagihan/bpjs-tk', icon: Briefcase },
      { key: 'internet', label: 'Internet Pascabayar', description: 'IndiHome & sejenis', path: '/dashboard/tagihan/internet', icon: Wifi },
      { key: 'tv', label: 'TV Pascabayar', description: 'TV kabel / satelit', path: '/dashboard/tagihan/tv', icon: Tv },
      { key: 'gas', label: 'Gas Negara', description: 'PGN / gas', path: '/dashboard/tagihan/gas', icon: Flame },
      { key: 'pbb', label: 'PBB', description: 'Pajak bumi & bangunan', path: '/dashboard/tagihan/pbb', icon: Home },
      { key: 'samsat', label: 'SAMSAT', description: 'Pajak kendaraan', path: '/dashboard/tagihan/samsat', icon: Car },
      { key: 'multifinance', label: 'Multifinance', description: 'Angsuran kredit', path: '/dashboard/tagihan/multifinance', icon: Landmark },
      { key: 'lainnya', label: 'Tagihan Lainnya', description: 'Katalog tagihan umum', path: '/dashboard/tagihan/lainnya', icon: Receipt },
    ]}
  />
);
