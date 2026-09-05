import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import { colors, typography } from '../../theme';
import { formatIDR } from '../../utils/currency';

export type DonutSlice = {
  key: string;
  label: string;
  amount: number;
  color: string;
};

type Props = {
  slices: DonutSlice[];
  /** Center primary line (e.g. "Total" or "Net"). */
  centerLabel: string;
  /** Center value — already formatted or numeric IDR. */
  centerValue: number;
  size?: number;
  strokeWidth?: number;
};

/**
 * Lightweight donut chart via react-native-svg (already in project).
 * No third-party chart library.
 */
export function DonutChart({
  slices,
  centerLabel,
  centerValue,
  size = 168,
  strokeWidth = 22,
}: Props) {
  const total = slices.reduce((s, x) => s + Math.max(0, x.amount), 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cx = size / 2;
  const cy = size / 2;

  let offset = 0;
  const arcs =
    total <= 0
      ? null
      : slices
          .filter((s) => s.amount > 0)
          .map((slice) => {
            const portion = slice.amount / total;
            const length = portion * circumference;
            const dashoffset = -offset;
            offset += length;
            return (
              <Circle
                key={slice.key}
                cx={cx}
                cy={cy}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={dashoffset}
                strokeLinecap="butt"
                fill="none"
              />
            );
          });

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${cx}, ${cy}`}>
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke={colors.gray[100]}
              strokeWidth={strokeWidth}
              fill="none"
            />
            {arcs}
          </G>
        </Svg>
        <View style={[styles.center, { width: size, height: size }]} pointerEvents="none">
          <Text style={styles.centerLabel}>{centerLabel}</Text>
          <Text style={styles.centerValue} numberOfLines={1}>
            {formatIDR(centerValue)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  centerLabel: {
    fontSize: 10,
    fontWeight: typography.weight.bold,
    color: colors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    textAlign: 'center',
  },
  centerValue: {
    fontSize: typography.size.sm,
    fontWeight: typography.weight.black,
    color: colors.gray[900],
    marginTop: 2,
    textAlign: 'center',
  },
});
