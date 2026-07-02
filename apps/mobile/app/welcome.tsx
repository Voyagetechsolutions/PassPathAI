import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Target, TrendUp, Clipboard } from '../src/components/icons';
import { colors, radius, spacing } from '../src/theme';

const { width: W } = Dimensions.get('window');
const SEEN_WELCOME_KEY = 'passpath.seenWelcome';

const SLIDES = [
  { icon: Target, title: 'Smart Preparation.\nBetter Results.', body: 'AI-powered insights and personalised practice to help you achieve your exam goals.' },
  { icon: TrendUp, title: 'Track. Analyse.\nImprove.', body: 'Detailed performance analytics to identify strengths and improve weak areas.' },
  { icon: Clipboard, title: 'Customised for\nEvery Learner', body: 'Adaptive lessons and smart recommendations, tailored just for you.' },
];

export default function Welcome() {
  const router = useRouter();
  const listRef = useRef<FlatList>(null);
  const [index, setIndex] = useState(0);

  async function finish() {
    await AsyncStorage.setItem(SEEN_WELCOME_KEY, '1');
    router.replace('/login');
  }

  function next() {
    if (index < SLIDES.length - 1) {
      listRef.current?.scrollToIndex({ index: index + 1, animated: true });
    } else {
      void finish();
    }
  }

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / W));
  }

  const isLast = index === SLIDES.length - 1;

  return (
    <SafeAreaView style={styles.safe}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        renderItem={({ item }) => {
          const Icon = item.icon;
          return (
            <View style={{ width: W, alignItems: 'center', paddingHorizontal: spacing.xl }}>
              <View style={{ flex: 1 }} />
              <View style={styles.iconRing}>
                <Icon color={colors.brand} size={72} />
              </View>
              <Text style={styles.title}>{item.title}</Text>
              <Text style={styles.body}>{item.body}</Text>
              <View style={{ flex: 1.4 }} />
            </View>
          );
        }}
      />

      <View style={styles.dots}>
        {SLIDES.map((_, i) => (
          <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
        ))}
      </View>

      <View style={styles.footer}>
        <Pressable onPress={finish} hitSlop={10} disabled={isLast}>
          <Text style={[styles.skip, isLast && { opacity: 0 }]}>SKIP</Text>
        </Pressable>
        {isLast ? (
          <Pressable onPress={next} style={styles.cta}>
            <Text style={styles.ctaText}>GET STARTED</Text>
          </Pressable>
        ) : (
          <Pressable onPress={next} hitSlop={10}>
            <Text style={styles.next}>NEXT</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  iconRing: { width: 176, height: 176, borderRadius: 88, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xxl },
  title: { fontSize: 24, fontFamily: 'Poppins_700Bold', color: colors.navy, textAlign: 'center', lineHeight: 32 },
  body: { fontSize: 14, fontFamily: 'Poppins_400Regular', color: colors.ink400, textAlign: 'center', marginTop: spacing.md, lineHeight: 21, maxWidth: 300 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: spacing.xl },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line },
  dotActive: { width: 18, backgroundColor: colors.brand },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xl, paddingBottom: spacing.xl },
  skip: { fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.ink300, letterSpacing: 0.5 },
  next: { fontSize: 13, fontFamily: 'Poppins_700Bold', color: colors.brand, letterSpacing: 0.5 },
  cta: { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: spacing.xl, paddingVertical: 13, marginLeft: 'auto' },
  ctaText: { color: colors.white, fontSize: 13, fontFamily: 'Poppins_700Bold', letterSpacing: 0.5 },
});
