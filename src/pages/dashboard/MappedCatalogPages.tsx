import { ProviderCatalogFlow } from '../../components/catalog/ProviderCatalogFlow';

/** Thin wrappers: category slug is GurkyNet-mapped, products from API only. */

export const TopUpDigitalPage = () => (
  <ProviderCatalogFlow
    category="topup-digital"
    title="Top Up Digital"
    subtitle="GoPay, OVO, DANA, ShopeePay, LinkAja, dan e-wallet lain. Pilih provider dulu, lalu nominal dari katalog."
    serviceName="Top Up Digital"
    returnPath="/dashboard/topup-digital"
    targetMode="phone"
    targetLabel="Nomor HP E-Wallet"
    targetPlaceholder="08xxxxxxxxxx"
  />
);

export const LanggananDigitalPage = () => (
  <ProviderCatalogFlow
    category="langganan-digital"
    title="Langganan Digital"
    subtitle="Netflix, Spotify, YouTube Premium, Vidio, WeTV, Canva, dan layanan berlangganan lain."
    serviceName="Langganan Digital"
    returnPath="/dashboard/langganan-digital"
    targetMode="customer"
    targetLabel="Email / Akun"
    targetPlaceholder="email@contoh.com atau ID akun"
  />
);

export const InternationalTopUpPage = () => (
  <ProviderCatalogFlow
    category="international"
    title="International Top Up"
    subtitle="Top up internasional (China, Malaysia, Singapore, Thailand, Vietnam, Philippines, dll)."
    serviceName="International Top Up"
    returnPath="/dashboard/international"
    targetMode="phone"
    targetLabel="Nomor HP Internasional"
    targetPlaceholder="Kode negara + nomor"
  />
);

export const TelcoSmsTeleponPage = () => (
  <ProviderCatalogFlow
    category="sms-telepon"
    title="Paket SMS & Telepon"
    subtitle="Paket nelpon dan SMS dari katalog provider."
    serviceName="Paket SMS & Telepon"
    returnPath="/dashboard/telekomunikasi/sms-telepon"
    targetMode="phone"
  />
);

export const TelcoMasaAktifPage = () => (
  <ProviderCatalogFlow
    category="masa-aktif"
    title="Masa Aktif"
    subtitle="Perpanjang masa aktif kartu dari katalog provider."
    serviceName="Masa Aktif"
    returnPath="/dashboard/telekomunikasi/masa-aktif"
    targetMode="phone"
  />
);

export const TelcoAktivasiPerdanaPage = () => (
  <ProviderCatalogFlow
    category="aktivasi-perdana"
    title="Aktivasi Perdana"
    subtitle="Aktivasi kartu perdana dari katalog provider."
    serviceName="Aktivasi Perdana"
    returnPath="/dashboard/telekomunikasi/aktivasi-perdana"
    targetMode="phone"
  />
);

export const TelcoEsimPage = () => (
  <ProviderCatalogFlow
    category="esim"
    title="eSIM"
    subtitle="Produk eSIM dari katalog provider."
    serviceName="eSIM"
    returnPath="/dashboard/telekomunikasi/esim"
    targetMode="phone"
  />
);

export const TagihanSubPage = ({
  category,
  title,
  subtitle,
  path,
}: {
  category: string;
  title: string;
  subtitle: string;
  path: string;
}) => (
  <ProviderCatalogFlow
    category={category}
    title={title}
    subtitle={subtitle}
    serviceName={title}
    returnPath={path}
    targetMode="customer"
    targetLabel="ID Pelanggan / No. Meter"
    targetPlaceholder="Masukkan ID pelanggan"
  />
);
