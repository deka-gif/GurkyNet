import { PhoneOperatorCatalogFlow } from '../../components/catalog/PhoneOperatorCatalogFlow';
import { AktivasiPerdanaFlow } from '../../components/catalog/AktivasiPerdanaFlow';
import { EsimCatalogFlow } from '../../components/catalog/EsimCatalogFlow';
import { ProviderCatalogFlow } from '../../components/catalog/ProviderCatalogFlow';
import { BillPaymentFlow } from '../../components/catalog/BillPaymentFlow';
import { PajakNegaraFlow } from '../../components/catalog/PajakNegaraFlow';

/** Thin wrappers: category slug is GurkyNet-mapped, products from API only. */

export const TopUpDigitalPage = () => (
  <ProviderCatalogFlow
    category="topup-digital"
    title="E-Wallet"
    subtitle="GoPay, OVO, DANA, ShopeePay, LinkAja, dan e-wallet lain. Pilih provider dulu, lalu nominal dari katalog."
    serviceName="E-Wallet"
    returnPath="/dashboard/topup-digital"
    targetMode="phone"
    targetLabel="Nomor HP"
    targetPlaceholder="08xxxxxxxxxx"
    inquiryMode="ewallet"
  />
);

export const LanggananDigitalPage = () => (
  <ProviderCatalogFlow
    category="langganan-digital"
    title="Langganan Digital"
    subtitle="Netflix, Spotify, YouTube Premium, Vidio, WeTV, Canva, dan layanan berlangganan lain."
    serviceName="Langganan Digital"
    returnPath="/dashboard/langganan-digital"
    targetMode="none"
    providerSearchPlaceholder="Ketik nama aplikasi streaming atau produktivitas..."
    inquiryMode="langganan"
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
  <PhoneOperatorCatalogFlow
    category="sms-telepon"
    title="Paket SMS & Telepon"
    subtitle="Masukkan nomor HP — operator terdeteksi otomatis. Produk dari katalog Digiflazz/VIP."
    serviceName="Paket SMS & Telepon"
    returnPath="/dashboard/telekomunikasi/sms-telepon"
    searchPlaceholder="Cari paket SMS / nelpon..."
  />
);

export const TelcoMasaAktifPage = () => (
  <PhoneOperatorCatalogFlow
    category="masa-aktif"
    title="Masa Aktif"
    subtitle="Perpanjang masa aktif kartu. Operator terdeteksi dari nomor HP Anda."
    serviceName="Masa Aktif"
    returnPath="/dashboard/telekomunikasi/masa-aktif"
    searchPlaceholder="Cari masa aktif..."
  />
);

export const TelcoAktivasiPerdanaPage = () => <AktivasiPerdanaFlow />;

export const TelcoEsimPage = () => <EsimCatalogFlow />;

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
}) => {
  if (category === 'pbb' || category === 'samsat') {
    return (
      <PajakNegaraFlow
        key={category}
        category={category}
        title={title}
        subtitle={subtitle}
        returnPath={path}
      />
    );
  }

  return (
    <BillPaymentFlow
      key={category}
      category={category}
      title={title}
      subtitle={subtitle}
      serviceName={title}
      returnPath={path}
      targetLabel="Nomor / ID Pelanggan"
      targetPlaceholder="Masukkan nomor atau ID pelanggan"
    />
  );
};
