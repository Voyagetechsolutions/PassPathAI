import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path } from 'react-native-svg';
import { useAuth } from '../src/lib/auth';
import { LogoMark } from '../src/components/brand';
import { colors } from '../src/theme';

const SEEN_WELCOME_KEY = 'passpath.seenWelcome';

export default function Index() {
  const { profile, loading } = useAuth();
  const [seenWelcome, setSeenWelcome] = useState<boolean | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(SEEN_WELCOME_KEY)
      .then((v) => setSeenWelcome(v === '1'))
      .catch(() => setSeenWelcome(true));
  }, []);

  if (loading || seenWelcome === null) {
    return <Splash />;
  }
  if (profile) return <Redirect href="/(tabs)" />;
  return seenWelcome ? <Redirect href="/login" /> : <Redirect href="/welcome" />;
}

function Splash() {
  return (
    <View style={styles.splash}>
      <View style={{ flex: 1 }} />
      <LogoMark size={92} />
      <Text style={styles.wordmark}>
        Pass<Text style={{ color: colors.brand }}>Path</Text>
      </Text>
      <Text style={styles.kicker}>AI-POWERED EXAM PERFORMANCE ENGINE</Text>
      <View style={{ flex: 1 }} />

      <View style={styles.waveWrap}>
        <Svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="none">
          <Path d="M0 60 C 100 10, 300 110, 400 40 L400 160 L0 160 Z" fill={colors.brand} />
        </Svg>
        <View style={styles.waveContent}>
          <Text style={styles.tagline}>Your Path to{'\n'}Exam Success</Text>
          <View style={styles.progressTrack}>
            <View style={styles.progressFill} />
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', backgroundColor: colors.white },
  wordmark: { marginTop: 20, fontSize: 30, fontFamily: 'Poppins_700Bold', color: colors.navy, letterSpacing: -0.5 },
  kicker: { marginTop: 6, fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: colors.ink300, letterSpacing: 1.4 },
  waveWrap: { width: '100%', height: 200, justifyContent: 'flex-end' },
  waveContent: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center', paddingBottom: 40 },
  tagline: { color: colors.white, fontSize: 18, fontFamily: 'Poppins_600SemiBold', textAlign: 'center', lineHeight: 24, marginBottom: 18 },
  progressTrack: { width: 120, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.35)', overflow: 'hidden' },
  progressFill: { width: '55%', height: '100%', borderRadius: 2, backgroundColor: colors.white },
});
