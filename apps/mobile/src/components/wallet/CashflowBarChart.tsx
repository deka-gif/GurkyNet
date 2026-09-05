import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { colors, spacing, typography } from '../../theme';
import type { CashflowWeekBucket } from '../../utils/walletCashflow';
import {
  buildDynamicYAxis,
  cashflowMaxValue,
  formatCompactIdr,
} from '../../utils/walletCashflow';

const OUT_COLOR = '#EF4444'; // Uang Keluar — merah
const IN_COLOR = colors.primary[500]; // Uang Masuk — hijau brand

type Props = {
  buckets: CashflowWeekBucket[];
  height?: number;
};

/**
 * Cashflow grouped bar chart (SVG) — linear scale, dynamic Y domain.
 * No dummy data; empty when all zeros.
 */
export function CashflowBarChart({ buckets, height = 200 }: Props) {
  const { width: screenW } = useWindowDimensions();
  const chartWidth = Math.min(screenW - spacing.xl * 2 - spacing.lg * 2, 360);
  const padLeft = 40;
  const padRight = 8;
  const padTop = 12;
  const padBottom = 28;
  const plotW = chartWidth - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const maxVal = cashflowMaxValue(buckets);
  const { domainMax, ticks } = buildDynamicYAxis(maxVal);
  const empty = maxVal <= 0;

  const groupCount = Math.max(buckets.length, 1);
  const groupW = plotW / groupCount;
  const barGap = 3;
  const barW = Math.max(4, (groupW - barGap * 3) / 2);

  return (
    <View style={styles.wrap}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: OUT_COLOR }]} />
          <Text style={styles.legendText}>Uang Keluar</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: IN_COLOR }]} />
          <Text style={styles.legendText}>Uang Masuk</Text>
        </View>
      </View>

      <Svg width={chartWidth} height={height}>
        {/* Y grid + labels */}
        {ticks.map((tick) => {
          const y =
            padTop + plotH - (domainMax <= 0 ? 0 : (tick / domainMax) * plotH);
          return (
            <SvgText
              key={`y-${tick}`}
              x={padLeft - 6}
              y={y + 3}
              fontSize={10}
              fill={colors.gray[400]}
              textAnchor="end"
            >
              {formatCompactIdr(tick)}
            </SvgText>
          );
        })}
        {ticks.map((tick) => {
          const y =
            padTop + plotH - (domainMax <= 0 ? 0 : (tick / domainMax) * plotH);
          return (
            <Line
              key={`g-${tick}`}
              x1={padLeft}
              y1={y}
              x2={padLeft + plotW}
              y2={y}
              stroke={colors.gray[100]}
              strokeWidth={1}
            />
          );
        })}

        {/* Baseline */}
        <Line
          x1={padLeft}
          y1={padTop + plotH}
          x2={padLeft + plotW}
          y2={padTop + plotH}
          stroke={colors.gray[200]}
          strokeWidth={1}
        />

        {!empty
          ? buckets.map((b, i) => {
              const gx = padLeft + i * groupW + groupW / 2;
              const outH = domainMax > 0 ? (b.expense / domainMax) * plotH : 0;
              const inH = domainMax > 0 ? (b.income / domainMax) * plotH : 0;
              const baseY = padTop + plotH;
              const outX = gx - barW - barGap / 2;
              const inX = gx + barGap / 2;
              return (
                <G key={b.label}>
                  {outH > 0 ? (
                    <Rect
                      x={outX}
                      y={baseY - outH}
                      width={barW}
                      height={Math.max(outH, 1)}
                      rx={3}
                      fill={OUT_COLOR}
                    />
                  ) : null}
                  {inH > 0 ? (
                    <Rect
                      x={inX}
                      y={baseY - inH}
                      width={barW}
                      height={Math.max(inH, 1)}
                      rx={3}
                      fill={IN_COLOR}
                    />
                  ) : null}
                  <SvgText
                    x={gx}
                    y={height - 8}
                    fontSize={9}
                    fill={colors.gray[500]}
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {b.label}
                  </SvgText>
                </G>
              );
            })
          : null}
      </Svg>

      {empty ? (
        <Text style={styles.emptyHint}>Belum ada cashflow di bulan ini.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm },
  legendRow: {
    flexDirection: 'row',
    gap: spacing.lg,
    alignSelf: 'flex-start',
    paddingLeft: 4,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: {
    fontSize: 11,
    color: colors.gray[600],
    fontWeight: typography.weight.medium,
  },
  emptyHint: {
    fontSize: typography.size.xs,
    color: colors.gray[500],
    textAlign: 'center',
    marginTop: -spacing.md,
    marginBottom: spacing.sm,
  },
});
