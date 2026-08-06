import { ProviderCatalogFlow } from '../../components/catalog/ProviderCatalogFlow';

export const VoucherDigitalPage = () => (
  <ProviderCatalogFlow
    category="voucher-digital"
    title="Voucher Digital"
    subtitle="Voucher belanja, e-gift, Google Play, Steam, dan brand voucher lain dari katalog provider."
    serviceName="Voucher Digital"
    returnPath="/dashboard/voucher-digital"
    targetMode="none"
    providerSearchPlaceholder="Ketik nama voucher belanja atau e-gift yang Anda cari..."
    inquiryMode="voucher"
  />
);
