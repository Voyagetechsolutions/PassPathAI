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
import { ChevronRight } from '../src/components/icons';
import { colors, radius, spacing, text } from '../src/theme';

const GRADES = [8, 9, 10, 11, 12];
const PROVINCES: Array<{ value: string; label: string }> = [
  { value: 'EASTERN_CAPE', label: 'Eastern Cape' },
  { value: 'FREE_STATE', label: 'Free State' },
  { value: 'GAUTENG', label: 'Gauteng' },
  { value: 'KWAZULU_NATAL', label: 'KwaZulu-Natal' },
  { value: 'LIMPOPO', label: 'Limpopo' },
  { value: 'MPUMALANGA', label: 'Mpumalanga' },
  { value: 'NORTHERN_CAPE', label: 'Northern Cape' },
  { value: 'NORTH_WEST', label: 'North West' },
  { value: 'WESTERN_CAPE', label: 'Western Cape' },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        active && { backgroundColor: colors.navy, borderColor: colors.navy },
        pressed && { opacity: 0.7 },
      ]}
    >
      <Text style={{ color: active ? colors.white : colors.ink600, fontFamily: 'Poppins_600SemiBold', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [grade, setGrade] = useState(10);
  const [province, setProvince] = useState('GAUTENG');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    if (password.length < 6) return setError('Password must be at least 6 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setBusy(true);
    try {
      await register(email.trim(), password, { firstName: firstName.trim(), surname: surname.trim(), grade, province });
      router.replace('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Registration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
            <View style={{ transform: [{ rotate: '180deg' }] }}>
              <ChevronRight color={colors.ink400} size={20} />
            </View>
            <Text style={[text.label, { color: colors.ink400 }]}>Back</Text>
          </Pressable>

          <Text style={text.h1}>Create your account</Text>
          <Text style={[text.body, { marginTop: 4, marginBottom: spacing.lg }]}>
            Your personal exam success system starts here.
          </Text>

          <Card>
            {error ? <View style={{ marginBottom: spacing.md }}><ErrorText message={error} /></View> : null}

            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <Text style={text.label}>First name</Text>
                <TextInput value={firstName} onChangeText={setFirstName} style={styles.input} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={text.label}>Surname</Text>
                <TextInput value={surname} onChangeText={setSurname} style={styles.input} />
              </View>
            </View>

            <Text style={[text.label, { marginTop: spacing.md }]}>Email</Text>
            <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.ink300} style={styles.input} />

            <Text style={[text.label, { marginTop: spacing.md }]}>Grade</Text>
            <View style={styles.chipRow}>
              {GRADES.map((g) => (
                <Chip key={g} label={`Grade ${g}`} active={grade === g} onPress={() => setGrade(g)} />
              ))}
            </View>

            <Text style={[text.label, { marginTop: spacing.md }]}>Province</Text>
            <View style={styles.chipRow}>
              {PROVINCES.map((p) => (
                <Chip key={p.value} label={p.label} active={province === p.value} onPress={() => setProvince(p.value)} />
              ))}
            </View>

            <Text style={[text.label, { marginTop: spacing.md }]}>Password</Text>
            <TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 6 characters" placeholderTextColor={colors.ink300} style={styles.input} />

            <Text style={[text.label, { marginTop: spacing.md }]}>Confirm password</Text>
            <TextInput value={confirm} onChangeText={setConfirm} secureTextEntry style={styles.input} />

            <View style={{ marginTop: spacing.lg }}>
              <PrimaryButton label={busy ? 'Creating account…' : 'Create account'} onPress={submit} disabled={busy} />
            </View>
          </Card>

          <Pressable onPress={() => router.replace('/login')} style={{ marginTop: spacing.lg }}>
            <Text style={[text.caption, { textAlign: 'center' }]}>
              Already have an account? <Text style={{ color: colors.brand, fontFamily: 'Poppins_700Bold' }}>Sign in</Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.md },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
    marginTop: 6,
    fontSize: 15,
    color: colors.ink,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.white,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 8 },
});
