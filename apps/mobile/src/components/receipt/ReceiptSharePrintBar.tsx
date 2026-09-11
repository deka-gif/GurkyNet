import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ReceiptData } from '../../services/transaction.service';
import { Button } from '../ui';
import { colors, spacing, typography } from '../../theme';
import { composeLiveReceiptText, shareReceiptMessage } from '../../utils/shareReceiptFlow';

type Props = {
  receipt: ReceiptData;
  userName?: string | null;
  /** Navigate to dedicated Struk page (does not print). */
  onOpenStruk: () => void;
};

/**
 * Detail / Result action row: Share (native) + Cetak Struk (navigate to /riwayat/struk/[id]).
 * No thermal preview here; no printer call on Cetak Struk.
 */
export function ReceiptSharePrintBar({ receipt, userName, onOpenStruk }: Props) {
  const [sharing, setSharing] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);

  const onShare = async () => {
    if (sharing) return;
    setSharing(true);
    setActionMsg(null);
    try {
      const text = await composeLiveReceiptText(receipt, userName);
      const result = await shareReceiptMessage(text);
      if (result === 'shared') setActionMsg('Struk dibagikan.');
      else if (result === 'failed') setActionMsg('Gagal membagikan struk.');
      else if (result === 'unavailable') setActionMsg('Struk kosong.');
    } catch {
      setActionMsg('Gagal membagikan struk.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.actionsRow}>
        <View style={styles.actionHalf}>
          <Button
            label={sharing ? 'Membagikan…' : 'Share'}
            variant="secondary"
            fullWidth
            loading={sharing}
            disabled={sharing}
            onPress={() => void onShare()}
            icon={<Ionicons name="share-outline" size={20} color={colors.primary[700]} />}
          />
        </View>
        <View style={styles.actionHalf}>
          <Button
            label="Cetak Struk"
            fullWidth
            disabled={sharing}
            onPress={onOpenStruk}
            icon={<Ionicons name="print-outline" size={20} color={colors.white} />}
          />
        </View>
      </View>
      {actionMsg ? <Text style={styles.actionMsg}>{actionMsg}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'stretch',
  },
  actionHalf: { flex: 1 },
  actionMsg: {
    fontSize: typography.size.sm,
    color: colors.gray[600],
    lineHeight: 20,
    textAlign: 'center',
  },
});
