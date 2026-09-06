import { EwalletTransferFlow } from '../../src/components/catalog/EwalletTransferFlow';

/**
 * Layanan → E-Wallet → brand — same PPOB engine as Transfer E-Wallet.
 * Manual nomor + nominal → inquiry → confirm → PIN → POST /transactions.
 */
export default function LayananEwalletFlowScreen() {
  return <EwalletTransferFlow entry="layanan" />;
}
