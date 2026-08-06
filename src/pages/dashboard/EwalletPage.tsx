import { ProviderCatalogFlow } from '../../components/catalog/ProviderCatalogFlow';

export const EwalletPage = () => (
  <ProviderCatalogFlow
    category="topup-digital"
    title="Top Up Digital"
    subtitle="GoPay, OVO, DANA, ShopeePay, LinkAja, dan e-wallet lain dari katalog provider."
    serviceName="Top Up Digital"
    returnPath="/dashboard/topup-digital"
    targetMode="phone"
    targetLabel="Nomor HP E-Wallet"
    targetPlaceholder="08xxxxxxxxxx"
  />
);
