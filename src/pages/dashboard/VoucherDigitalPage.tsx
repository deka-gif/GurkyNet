import { ProviderCatalogFlow } from '../../components/catalog/ProviderCatalogFlow';

export const VoucherDigitalPage = () => (
  <ProviderCatalogFlow
    category="voucher-digital"
    title="Voucher Digital"
    subtitle="Google Play, Apple Gift Card, Steam Wallet, Garena Shell, Razer Gold, PlayStation, Xbox, UniPin."
    serviceName="Voucher Digital"
    returnPath="/dashboard/voucher-digital"
    targetMode="phone"
    targetLabel="Nomor HP Penerima"
    targetPlaceholder="08xxxxxxxxxx"
  />
);
