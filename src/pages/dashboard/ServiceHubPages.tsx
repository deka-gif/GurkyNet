import {
  Smartphone,
  Wifi,
  MessageSquare,
  Clock,
  Nfc,
  Zap,
  Droplets,
  Heart,
  Tv,
  Flame,
  Home,
  Car,
  Landmark,
  Receipt,
  CreditCard,
  Gamepad2,
  Gift,
  PlayCircle,
  Globe,
  Send,
  FileText,
} from 'lucide-react';
import { ServiceHubPage } from '../../components/catalog/ServiceHubPage';

export const TelekomunikasiHubPage = () => (
  <ServiceHubPage
    title="Telekomunikasi"
    subtitle="Pulsa, paket data, voucher internet, SMS, masa aktif, perdana, dan eSIM dari katalog provider."
    tone="telco"
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
    tone="tagihan"
    children={[
      { key: 'pln', label: 'Token PLN', description: 'Token listrik prabayar', path: '/dashboard/token-pln', icon: Zap },
      { key: 'pln-pascabayar', label: 'PLN Pascabayar', description: 'Tagihan listrik pasca', path: '/dashboard/tagihan/pln-pascabayar', icon: Zap },
      { key: 'pdam', label: 'PDAM', description: 'Tagihan air', path: '/dashboard/tagihan/pdam', icon: Droplets },
      { key: 'bpjs', label: 'BPJS', description: 'BPJS Kesehatan & Ketenagakerjaan', path: '/dashboard/tagihan/bpjs', icon: Heart },
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

export const AllProductsPage = () => (
  <ServiceHubPage
    title="Semua Produk"
    subtitle="Jelajahi seluruh layanan GurkyNet dalam satu tempat."
    tone="all"
    children={[
      { key: 'pulsa', label: 'Pulsa', description: 'Isi pulsa semua operator', path: '/dashboard/pulsa', icon: Smartphone },
      { key: 'data', label: 'Paket Data', description: 'Kuota internet', path: '/dashboard/paket-data', icon: Wifi },
      { key: 'pln', label: 'Token PLN', description: 'Token listrik prabayar', path: '/dashboard/token-pln', icon: Zap },
      { key: 'topup-digital', label: 'E-Wallet', description: 'e-Wallet & dompet digital', path: '/dashboard/topup-digital', icon: CreditCard },
      { key: 'game', label: 'Game', description: 'Diamond & voucher game', path: '/dashboard/game', icon: Gamepad2 },
      { key: 'voucher', label: 'Voucher Digital', description: 'Voucher belanja & hiburan', path: '/dashboard/voucher-digital', icon: Gift },
      { key: 'voucher-internet', label: 'Voucher Internet', description: 'Tembak / e-voucher / fisik', path: '/dashboard/voucher-internet', icon: Wifi },
      { key: 'langganan', label: 'Langganan', description: 'Streaming & membership', path: '/dashboard/langganan-digital', icon: PlayCircle },
      { key: 'international', label: 'International', description: 'Top up luar negeri', path: '/dashboard/international', icon: Globe },
      { key: 'transfer', label: 'Transfer', description: 'Kirim saldo sesama user', path: '/dashboard/transfer', icon: Send },
      { key: 'tagihan', label: 'Tagihan', description: 'PLN, PDAM, BPJS & lainnya', path: '/dashboard/tagihan', icon: FileText },
    ]}
  />
);
