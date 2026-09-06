import { EwalletTransferFlow } from '../../../src/components/catalog/EwalletTransferFlow';

/**
 * Transfer → E-Wallet — PPOB topup-digital (inquiry + POST /transactions).
 * Not /wallet/transfer.
 */
export default function TransferEwalletScreen() {
  return <EwalletTransferFlow entry="transfer" />;
}
