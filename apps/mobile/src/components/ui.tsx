import { useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { colors, fonts, radius, shadow, spacing, text } from '../theme';

/** A draggable slider — tap or drag anywhere on the track. Powers the What-If tool. */
export function Slider({ value, min = 0, max = 100, step = 1, tone = colors.brand, onChange }: { value: number; min?: number; max?: number; step?: number; tone?: string; onChange: (v: number) => void }) {
  const [w, setW] = useState(1);
  const set = (x: number) => {
    const r = Math.max(0, Math.min(1, x / Math.max(1, w)));
    const v = Math.round((min + r * (max - min)) / step) * step;
    onChange(Math.max(min, Math.min(max, v)));
  };
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => set(e.nativeEvent.locationX),
      onPanResponderMove: (e) => set(e.nativeEvent.locationX),
    }),
  ).current;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <View onLayout={(e) => setW(e.nativeEvent.layout.width)} {...pan.panHandlers} style={{ height: 36, justifyContent: 'center' }}>
      <View style={{ height: 8, borderRadius: radius.pill, backgroundColor: colors.navy50 }}>
        <View style={{ height: 8, width: `${pct}%`, borderRadius: radius.pill, backgroundColor: tone }} />
      </View>
      <View style={{ position: 'absolute', left: `${pct}%`, marginLeft: -12, width: 24, height: 24, borderRadius: 12, backgroundColor: colors.white, borderWidth: 2.5, borderColor: tone, ...shadow.card }} />
    </View>
  );
}

/** A lightweight responsive line chart with a soft area fill. Stretches to width. */
export function LineChart({ data, height = 90, tone = colors.brand }: { data: number[]; height?: number; tone?: string }) {
  if (!data || data.length < 2) {
    return (
      <View style={{ height, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={[text.caption, { textAlign: 'center' }]}>Your trend appears as you practise.</Text>
      </View>
    );
  }
  const W = 100;
  const H = height;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => ({ x: (i / (data.length - 1)) * W, y: H - 6 - ((v - min) / range) * (H - 12) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  return (
    <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <Path d={area} fill={tone} opacity={0.1} />
      <Path d={line} stroke={tone} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </Svg>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function IconChip({
  children,
  tone = 'navy',
}: {
  children: ReactNode;
  tone?: 'navy' | 'brand' | 'emerald' | 'warn' | 'danger';
}) {
  const bg: Record<string, string> = {
    navy: colors.navy50,
    brand: colors.brand50,
    emerald: colors.emerald50,
    warn: colors.warn50,
    danger: colors.danger50,
  };
  return <View style={[styles.chip, { backgroundColor: bg[tone] }]}>{children}</View>;
}

export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={text.section}>{title}</Text>
      {action}
    </View>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <Card style={{ flex: 1 }}>
      {icon}
      <Text style={[text.label, { marginTop: icon ? spacing.md : 0 }]}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
      {hint ? <Text style={text.caption}>{hint}</Text> : null}
    </Card>
  );
}

export function Badge({
  children,
  tone = 'navy',
}: {
  children: ReactNode;
  tone?: 'navy' | 'emerald' | 'warn' | 'danger' | 'muted';
}) {
  const map: Record<string, { bg: string; fg: string }> = {
    navy: { bg: colors.navy50, fg: colors.navy },
    emerald: { bg: colors.emerald50, fg: colors.emerald },
    warn: { bg: colors.warn50, fg: colors.warn },
    danger: { bg: colors.danger50, fg: colors.danger },
    muted: { bg: colors.canvas, fg: colors.ink400 },
  };
  const c = map[tone];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={{ color: c.fg, fontSize: 12, fontFamily: fonts.semibold }}>{children}</Text>
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  disabled,
  icon,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btnPrimary,
        (pressed || disabled) && { opacity: 0.85 },
        disabled && { opacity: 0.5 },
      ]}
    >
      {icon}
      <Text style={styles.btnPrimaryText}>{label}</Text>
    </Pressable>
  );
}

export function SecondaryButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.btnSecondary, (pressed || disabled) && { opacity: 0.6 }]}
    >
      <Text style={styles.btnSecondaryText}>{label}</Text>
    </Pressable>
  );
}

export function ProgressBar({
  value,
  tone = 'brand',
}: {
  value: number;
  tone?: 'brand' | 'emerald' | 'warn' | 'danger';
}) {
  const map: Record<string, string> = {
    brand: colors.brand,
    emerald: colors.emerald,
    warn: colors.warn,
    danger: colors.danger,
  };
  return (
    <View style={styles.track}>
      <View
        style={{
          height: '100%',
          width: `${Math.max(0, Math.min(100, value))}%`,
          backgroundColor: map[tone],
          borderRadius: radius.pill,
        }}
      />
    </View>
  );
}

export function ScoreRing({ value, size = 140, label }: { value: number; size?: number; label?: string }) {
  const stroke = 13;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const tone = pct >= 75 ? colors.emerald : pct >= 50 ? colors.brand : colors.warn;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ transform: [{ rotate: '-90deg' }] }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.ringValue}>{Math.round(value)}%</Text>
        {label ? <Text style={text.caption}>{label}</Text> : null}
      </View>
    </View>
  );
}

export function ListRow({
  title,
  subtitle,
  left,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  left?: ReactNode;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const content = (
    <View style={styles.row}>
      {left}
      <View style={{ flex: 1 }}>
        <Text style={text.title}>{title}</Text>
        {subtitle ? <Text style={text.caption}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={colors.brand} />
      {label ? <Text style={[text.label, { marginTop: spacing.sm }]}>{label}</Text> : null}
    </View>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card>
      <Text style={text.title}>{title}</Text>
      <Text style={[text.body, { marginTop: 2 }]}>{message}</Text>
    </Card>
  );
}

export function ErrorText({ message }: { message: string }) {
  return (
    <View style={styles.error}>
      <Text style={{ color: colors.danger, fontSize: 14, fontFamily: fonts.medium }}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.card,
  },
  chip: {
    width: 38,
    height: 38,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  statValue: { fontSize: 25, fontFamily: fonts.bold, color: colors.ink, marginTop: 3, letterSpacing: -0.5 },
  badge: { borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 4, alignSelf: 'flex-start' },
  btnPrimary: {
    flexDirection: 'row',
    gap: spacing.sm,
    backgroundColor: colors.navy,
    borderRadius: radius.md,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimaryText: { color: colors.white, fontFamily: fonts.semibold, fontSize: 15, letterSpacing: 0.1 },
  btnSecondary: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  btnSecondaryText: { color: colors.ink600, fontFamily: fonts.semibold, fontSize: 14 },
  track: { height: 9, borderRadius: radius.pill, backgroundColor: colors.navy50, overflow: 'hidden' },
  ringCenter: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 30, fontFamily: fonts.bold, color: colors.ink, letterSpacing: -0.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  center: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl, gap: spacing.sm },
  error: {
    backgroundColor: colors.danger50,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
});
