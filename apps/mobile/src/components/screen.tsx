import type { ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronRight } from './icons';
import { colors, spacing, text } from '../theme';

export function Screen({
  children,
  title,
  subtitle,
  refreshing,
  onRefresh,
  onBack,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  refreshing?: boolean;
  onRefresh?: () => void;
  onBack?: () => void;
}) {
  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.brand} /> : undefined
        }
      >
        {onBack ? (
          <Pressable onPress={onBack} hitSlop={10} style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <ChevronRight color={colors.ink400} size={20} />
            </View>
            <Text style={[text.label, { color: colors.ink400 }]}>Back</Text>
          </Pressable>
        ) : null}
        {(title || subtitle) && (
          <View style={styles.header}>
            {title ? <Text style={text.h1}>{title}</Text> : null}
            {subtitle ? <Text style={[text.body, { marginTop: 4 }]}>{subtitle}</Text> : null}
          </View>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2, gap: spacing.lg },
  header: { marginBottom: spacing.xs },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.xs },
});
