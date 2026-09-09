import { Alert } from 'react-native';
import type { ReceiptData } from '../services/transaction.service';
import { printerService } from '../services/printer.service';

/**
 * Optional print flow — never mutates transaction state.
 * Missing printer → navigate to /akun/printer.
 */
export async function runPrintReceiptFlow(opts: {
  receipt: ReceiptData;
  userName?: string | null;
  router: { push: (href: '/akun/printer') => void };
  onMessage?: (msg: string) => void;
}): Promise<void> {
  try {
    await printerService.printTransactionReceipt(opts.receipt, opts.userName);
    opts.onMessage?.('Struk dikirim ke printer.');
  } catch (err: any) {
    if (err?.code === 'NO_PRINTER') {
      Alert.alert(
        'Printer belum terhubung',
        'Hubungkan printer Bluetooth terlebih dahulu sebelum mencetak struk.',
        [
          { text: 'Batal', style: 'cancel' },
          {
            text: 'Buka Printer',
            onPress: () => opts.router.push('/akun/printer'),
          },
        ]
      );
      return;
    }
    const message = err?.message || 'Gagal mencetak struk.';
    opts.onMessage?.(message);
    Alert.alert('Gagal mencetak', message);
  }
}
