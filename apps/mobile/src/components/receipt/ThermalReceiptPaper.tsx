import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { PaperWidthMm } from '../../services/receiptSettings.service';
import { charsPerLine, type ReceiptLine } from '../../utils/receiptPrint';
import { colors, spacing } from '../../theme';

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' });
const CHAR_PX = 7.1;

type Props = {
  lines: ReceiptLine[];
  paperWidthMm: PaperWidthMm;
};

/** Paper width in dp so `charsPerLine` fits without wrapping separators. */
function paperPixelWidth(paperWidthMm: PaperWidthMm, screenWidth: number): number {
  const chars = charsPerLine(paperWidthMm);
  const content = Math.ceil(chars * CHAR_PX) + 28;
  const max = Math.max(220, screenWidth - spacing.lg * 2);
  return Math.min(content, max);
}

/**
 * Visual thermal receipt — same lines as print.
 * Rules render as View borders (no character wrap); rows are label|value.
 */
export function ThermalReceiptPaper({ lines, paperWidthMm }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const paperW = paperPixelWidth(paperWidthMm, screenWidth);

  return (
    <View style={styles.stage}>
      <View style={[styles.shadow, { width: paperW }]}>
        <View style={[styles.paper, { width: paperW }]}>
          <View style={styles.tear} />
          <View style={styles.body}>
            {lines.map((line, index) => {
              if (line.kind === 'rule') {
                return (
                  <View
                    key={`r-${index}`}
                    style={[
                      styles.rule,
                      line.ruleChar === '=' ? styles.ruleEq : styles.ruleDash,
                    ]}
                  />
                );
              }
              if (line.kind === 'row' && line.label != null && line.value != null) {
                return (
                  <View key={`row-${index}`} style={styles.row}>
                    <Text
                      style={[styles.rowLabel, line.bold && styles.bold]}
                      numberOfLines={1}
                    >
                      {line.label}
                    </Text>
                    <Text
                      style={[styles.rowValue, line.bold && styles.bold]}
                      numberOfLines={2}
                    >
                      {line.value}
                    </Text>
                  </View>
                );
              }
              return (
                <Text
                  key={`t-${index}`}
                  style={[
                    styles.line,
                    line.align === 'center' && styles.alignCenter,
                    line.align === 'right' && styles.alignRight,
                    line.bold && styles.bold,
                    line.size === 2 && styles.size2,
                  ]}
                  numberOfLines={line.size === 2 ? 2 : 3}
                >
                  {line.text}
                </Text>
              );
            })}
          </View>
          <View style={styles.tear} />
          <Text style={styles.widthBadge}>{paperWidthMm} mm</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    backgroundColor: colors.gray[100],
    borderRadius: 12,
  },
  shadow: {
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  paper: {
    backgroundColor: '#FFFEF8',
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 16,
    borderRadius: 2,
    minHeight: 300,
  },
  tear: {
    height: 1,
    backgroundColor: colors.gray[200],
    marginVertical: 6,
  },
  body: { gap: 5, paddingVertical: 4 },
  rule: {
    alignSelf: 'stretch',
    marginVertical: 4,
  },
  ruleEq: {
    borderTopWidth: 2,
    borderTopColor: colors.gray[800],
  },
  ruleDash: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.gray[500],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowLabel: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray[600],
    flexShrink: 0,
    maxWidth: '42%',
  },
  rowValue: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray[900],
    flex: 1,
    textAlign: 'right',
  },
  line: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 16,
    color: colors.gray[900],
    textAlign: 'left',
  },
  alignCenter: { textAlign: 'center' },
  alignRight: { textAlign: 'right' },
  bold: { fontWeight: '700', color: colors.gray[900] },
  size2: { fontSize: 17, lineHeight: 22, fontWeight: '800' },
  widthBadge: {
    marginTop: 10,
    textAlign: 'center',
    fontSize: 10,
    color: colors.gray[400],
    fontWeight: '600',
  },
});
