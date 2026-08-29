import { ProviderCatalogFlow } from '../../components/catalog/ProviderCatalogFlow';

export const EwalletPage = () => (
  <ProviderCatalogFlow
    category="topup-digital"
    title="E-Wallet"
    subtitle="GoPay, OVO, DANA, ShopeePay, LinkAja, dan e-wallet lain dari katalog provider."
    serviceName="E-Wallet"
    returnPath="/dashboard/topup-digital"
    targetMode="phone"
    targetLabel="Nomor HP"
    targetPlaceholder="08xxxxxxxxxx"
    inquiryMode="ewallet"
  />
);
