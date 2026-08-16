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
import { Card, PrimaryButton, ErrorText, ProgressBar } from '../src/components/ui';
import { ChevronRight, Eye } from '../src/components/icons';
import { GRADES } from '../src/lib/sa';
import { colors, radius, spacing, text } from '../src/theme';

const PROVINCES = [
  ['EASTERN_CAPE', 'Eastern Cape'], ['FREE_STATE', 'Free State'], ['GAUTENG', 'Gauteng'],
  ['KWAZULU_NATAL', 'KwaZulu-Natal'], ['LIMPOPO', 'Limpopo'], ['MPUMALANGA', 'Mpumalanga'],
  ['NORTHERN_CAPE', 'Northern Cape'], ['NORTH_WEST', 'North West'], ['WESTERN_CAPE', 'Western Cape'],
] as const;

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { opacity: 0.75 }]}>
      <Text style={[styles.chipText, active && { color: colors.white }]}>{label}</Text>
    </Pressable>
  );
}

function PasswordInput({ value, onChangeText, placeholder }: { value: string; onChangeText: (value: string) => void; placeholder?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder={placeholder}
        placeholderTextColor={colors.ink300}
        style={styles.passwordInput}
      />
      <Pressable
        onPress={() => setVisible((current) => !current)}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
        hitSlop={10}
      >
        <Eye hidden={visible} color={colors.ink400} size={21} />
      </Pressable>
    </View>
  );
}

export default function Register() {
  const { register } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [surname, setSurname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [grade, setGrade] = useState(10);
  const [school, setSchool] = useState('');
  const [province, setProvince] = useState('GAUTENG');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function validateAccount(): string | null {
    if (!firstName.trim() || !surname.trim()) return 'Enter your name and surname.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.';
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (password !== confirm) return 'Passwords do not match.';
    return null;
  }

  function continueToSchool() {
    const message = validateAccount();
    setError(message);
    if (!message) setStep(1);
  }

  async function submit() {
    setError(null);
    if (!school.trim()) return setError('Enter the name of your school.');
    setBusy(true);
    try {
      await register(email.trim(), password, {
        firstName: firstName.trim(), surname: surname.trim(), grade, school: school.trim(), province,
      });
      router.replace('/onboarding');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create your account. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
        >
          <Pressable onPress={() => step === 1 ? setStep(0) : router.back()} hitSlop={10} style={styles.back}>
            <View style={{ transform: [{ rotate: '180deg' }] }}><ChevronRight color={colors.ink400} size={20} /></View>
            <Text style={[text.label, { color: colors.ink400 }]}>Back</Text>
          </Pressable>

          <Text style={text.section}>Step {step + 1} of 2</Text>
          <View style={{ marginTop: spacing.sm, marginBottom: spacing.lg }}><ProgressBar value={(step + 1) * 50} /></View>
          <Text style={text.h1}>{step === 0 ? 'Create your account' : 'Tell us about your school'}</Text>
          <Text style={[text.body, { marginTop: 4, marginBottom: spacing.lg }]}>
            {step === 0 ? 'Use your details to keep your learning progress safe.' : 'We use this to personalise your CAPS learning plan.'}
          </Text>

          <Card>
            {error ? <View style={{ marginBottom: spacing.md }}><ErrorText message={error} /></View> : null}
            {step === 0 ? (
              <>
                <Text style={text.label}>Name</Text>
                <TextInput value={firstName} onChangeText={setFirstName} autoCapitalize="words" autoComplete="given-name" style={styles.input} />
                <Text style={[text.label, { marginTop: spacing.md }]}>Surname</Text>
                <TextInput value={surname} onChangeText={setSurname} autoCapitalize="words" autoComplete="family-name" style={styles.input} />
                <Text style={[text.label, { marginTop: spacing.md }]}>Email address</Text>
                <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email" keyboardType="email-address" placeholder="you@example.com" placeholderTextColor={colors.ink300} style={styles.input} />
                <Text style={[text.label, { marginTop: spacing.md }]}>Password</Text>
                <PasswordInput value={password} onChangeText={setPassword} placeholder="At least 8 characters" />
                <Text style={[text.label, { marginTop: spacing.md }]}>Confirm password</Text>
                <PasswordInput value={confirm} onChangeText={setConfirm} placeholder="Enter it again" />
                <View style={{ marginTop: spacing.lg }}><PrimaryButton label="Continue" onPress={continueToSchool} /></View>
              </>
            ) : (
              <>
                <Text style={text.label}>Grade</Text>
                <View style={styles.chipRow}>{GRADES.map((g) => <Chip key={g} label={`Grade ${g}`} active={grade === g} onPress={() => setGrade(g)} />)}</View>
                <Text style={[text.label, { marginTop: spacing.lg }]}>School</Text>
                <TextInput value={school} onChangeText={setSchool} autoCapitalize="words" placeholder="Your school name" placeholderTextColor={colors.ink300} style={styles.input} />
                <Text style={[text.label, { marginTop: spacing.lg }]}>Province</Text>
                <View style={styles.chipRow}>{PROVINCES.map(([value, label]) => <Chip key={value} label={label} active={province === value} onPress={() => setProvince(value)} />)}</View>
                <View style={{ marginTop: spacing.lg }}><PrimaryButton label={busy ? 'Creating account…' : 'Create account'} onPress={submit} disabled={busy} /></View>
              </>
            )}
          </Card>

          {step === 0 ? <Pressable onPress={() => router.replace('/login')} style={{ marginTop: spacing.lg }}>
            <Text style={[text.caption, { textAlign: 'center' }]}>Already have an account? <Text style={{ color: colors.brand, fontFamily: 'Poppins_700Bold' }}>Sign in</Text></Text>
          </Pressable> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.canvas },
  content: { padding: spacing.xl, paddingBottom: spacing.xxl * 2 },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, marginBottom: spacing.md },
  input: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, marginTop: 6, fontSize: 15, color: colors.ink },
  passwordWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingRight: spacing.md, marginTop: 6 },
  passwordInput: { flex: 1, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.ink },
  chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { color: colors.ink600, fontFamily: 'Poppins_600SemiBold', fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 8 },
});
