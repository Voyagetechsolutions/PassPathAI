import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../src/lib/auth';
import { Card, PrimaryButton, ErrorText } from '../src/components/ui';
import { LogoMark } from '../src/components/brand';
import { colors, radius, spacing, text } from '../src/theme';

export default function Login() {
  const { login, authError } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const error = localError ?? authError;

  async function signIn() {
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
      router.replace('/(tabs)');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.brandRow}>
            <LogoMark size={44} />
            <Text style={styles.wordmark}>
              Pass<Text style={{ color: colors.brand }}>Path</Text>
            </Text>
          </View>
          <Text style={[text.h1, { textAlign: 'center', marginTop: spacing.lg }]}>Welcome back</Text>
          <Text style={[text.body, { textAlign: 'center', marginTop: 4 }]}>Sign in to keep preparing for your exams.</Text>

          <Card style={{ marginTop: spacing.xl }}>
            {error ? <View style={{ marginBottom: spacing.md }}><ErrorText message={error} /></View> : null}
            <Text style={text.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={colors.ink300}
              style={styles.input}
            />
            <Text style={[text.label, { marginTop: spacing.md }]}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={colors.ink300}
              style={styles.input}
            />
            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton label={busy ? 'Signing in…' : 'Sign in'} onPress={signIn} disabled={busy} />
            </View>
          </Card>

          <Pressable onPress={() => router.push('/register')} style={{ marginTop: spacing.lg }}>
            <Text style={[text.caption, { textAlign: 'center' }]}>
              New to PassPath? <Text style={{ color: colors.brand, fontFamily: 'Poppins_700Bold' }}>Create an account</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingTop: spacing.xxl, justifyContent: 'center', flexGrow: 1 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.md },
  wordmark: { fontSize: 22, fontFamily: 'Poppins_700Bold', color: colors.navy, letterSpacing: -0.3 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    marginTop: 6,
    fontSize: 15,
    color: colors.ink,
  },
});
