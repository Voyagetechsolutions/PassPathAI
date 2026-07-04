import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { useApi } from '../src/lib/use-api';
import { Screen } from '../src/components/screen';
import { Card, ProgressBar, Slider, SkeletonCard, ErrorText } from '../src/components/ui';
import { Check, Target, TrendUp } from '../src/components/icons';
import { careerEmoji, computeAps, factsFor } from '../src/lib/careers';
import { colors, radius, spacing, text } from '../src/theme';
import type { CareerDetail, SubjectMark } from '../src/lib/types';

const GREEN = '#16A34A';
const demandStars = (d: string) => (d === 'Very High' ? '★★★★★' : d === 'High' ? '★★★★☆' : d === 'Moderate' ? '★★★☆☆' : '★★★☆☆');

export default function CareerDetailScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { careerId } = useLocalSearchParams<{ careerId: string }>();
  const { data: career, loading, error } = useApi<CareerDetail>(careerId ? `/careers/${careerId}` : null);
  const [marks, setMarks] = useState<Record<string, number>>({});

  useEffect(() => {
    apiRequest<SubjectMark[]>('/profile/marks', { token })
      .then((m) => setMarks(Object.fromEntries(m.map((x) => [x.subjectName, x.mark]))))
      .catch(() => {});
  }, [token]);

  const [wiSubject, setWiSubject] = useState<string | null>(null);
  const [wiMark, setWiMark] = useState(60);

  const norm = (s: string) => s.trim().toLowerCase();
  const markFor = (name: string) => marks[Object.keys(marks).find((k) => norm(k) === norm(name)) ?? ''] ?? undefined;

  const aps = useMemo(() => computeAps(Object.values(marks)), [marks]);
  const neededAps = useMemo(() => (career && career.programmes.length ? Math.min(...career.programmes.map((p) => p.minAps)) : null), [career]);

  // Default What-If to the first required subject the student is weakest in.
  useEffect(() => {
    if (career && wiSubject === null && career.subjectRequirements.length > 0) {
      const weakest = [...career.subjectRequirements].sort((a, b) => (markFor(a.subjectName) ?? 0) - (markFor(b.subjectName) ?? 0))[0];
      setWiSubject(weakest.subjectName);
      setWiMark(markFor(weakest.subjectName) ?? 50);
    }
  }, [career, wiSubject]); // eslint-disable-line react-hooks/exhaustive-deps

  const whatIf = useMemo(() => {
    if (!wiSubject || !career) return null;
    const newMarks = { ...marks, [wiSubject]: wiMark };
    const newAps = computeAps(Object.values(newMarks));
    const progsNow = career.programmes.filter((p) => aps >= p.minAps).length;
    const progsNew = career.programmes.filter((p) => newAps >= p.minAps).length;
    return { newAps, progsNow, progsNew };
  }, [wiSubject, wiMark, marks, career, aps]);

  if (loading)
    return (
      <Screen onBack={() => router.back()}>
        <SkeletonCard lines={4} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </Screen>
    );
  if (error || !career) return <Screen onBack={() => router.back()}><ErrorText message={error ?? 'Career not found.'} /></Screen>;

  const facts = factsFor(career.faculty);
  const apsPct = neededAps ? Math.min(100, Math.round((aps / neededAps) * 100)) : 100;
  const apsTone = neededAps && aps >= neededAps ? GREEN : aps >= (neededAps ?? 0) - 4 ? colors.warn : colors.danger;
  const apsWord = neededAps && aps >= neededAps ? 'You qualify!' : aps >= (neededAps ?? 0) - 4 ? 'Almost there' : 'Keep building';
  const unmet = career.subjectRequirements.filter((r) => (markFor(r.subjectName) ?? 0) < r.minPercent);
  const months = Math.max(2, Math.min(18, unmet.reduce((s, r) => s + Math.ceil((r.minPercent - (markFor(r.subjectName) ?? 0)) / 5) * 1.5, 0)) || 3);

  return (
    <Screen title={career.title} subtitle={career.description} onBack={() => router.back()}>
      {/* Salary */}
      <Card style={{ backgroundColor: colors.navy }}>
        <Text style={{ fontSize: 40, marginBottom: spacing.sm }}>{careerEmoji(career.title, career.faculty)}</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontFamily: 'Poppins_600SemiBold' }}>TYPICAL SALARY (SA)</Text>
        <Text style={{ color: colors.white, fontSize: 28, fontFamily: 'Poppins_700Bold', marginTop: 2 }}>{facts.salary}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.lg }}>
          <View>
            <Text style={{ color: '#FBBF24', fontSize: 15, letterSpacing: 2 }}>{demandStars(facts.demand)}</Text>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>Demand · {facts.demand}</Text>
          </View>
          <View style={{ backgroundColor: 'rgba(124,226,168,0.18)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6, alignSelf: 'center' }}>
            <Text style={{ color: '#7CE2A8', fontSize: 12, fontFamily: 'Poppins_700Bold' }}>{facts.outlook} industry</Text>
          </View>
        </View>
      </Card>

      {/* Required subjects */}
      <Card>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Required Subjects</Text>
        <View style={{ gap: spacing.md }}>
          {career.subjectRequirements.map((r) => {
            const mark = markFor(r.subjectName);
            const met = (mark ?? 0) >= r.minPercent;
            return (
              <View key={r.subjectName} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: met ? '#E7F6EC' : colors.warn50, alignItems: 'center', justifyContent: 'center' }}>
                  {met ? <Check color={GREEN} size={16} /> : <Text style={{ color: colors.warn, fontSize: 15, fontFamily: 'Poppins_700Bold' }}>!</Text>}
                </View>
                <Text style={[text.body, { color: colors.ink, flex: 1, fontFamily: 'Poppins_500Medium' }]}>{r.subjectName}</Text>
                <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: met ? GREEN : colors.warn }}>
                  {mark !== undefined ? `${mark}%` : '—'} / {r.minPercent}%
                </Text>
              </View>
            );
          })}
        </View>
      </Card>

      {/* Required APS */}
      {neededAps ? (
        <Card style={{ alignItems: 'center' }}>
          <Text style={[text.label, { alignSelf: 'flex-start' }]}>Admission Points (APS)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.md }}>
            <Text style={{ fontSize: 44, fontFamily: 'Poppins_700Bold', color: apsTone }}>{aps}</Text>
            <Text style={{ fontSize: 18, color: colors.ink400 }}>/ {neededAps} needed</Text>
          </View>
          <View style={{ alignSelf: 'stretch', marginTop: spacing.md }}>
            <ProgressBar value={apsPct} tone={apsTone === GREEN ? 'emerald' : apsTone === colors.warn ? 'warn' : 'danger'} />
          </View>
          <Text style={{ fontSize: 14, fontFamily: 'Poppins_700Bold', color: apsTone, marginTop: spacing.md }}>{apsWord}</Text>
        </Card>
      ) : null}

      {/* What If? */}
      {whatIf && wiSubject ? (
        <Card style={{ borderColor: colors.brand, borderWidth: 1.5 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
            <TrendUp color={colors.brand} size={20} />
            <Text style={text.title}>What if you improved…?</Text>
          </View>
          {career.subjectRequirements.length > 1 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginBottom: spacing.md }}>
              {career.subjectRequirements.map((r) => {
                const active = wiSubject === r.subjectName;
                return (
                  <Pressable key={r.subjectName} onPress={() => { setWiSubject(r.subjectName); setWiMark(markFor(r.subjectName) ?? 50); }} style={{ paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.brand : colors.white }}>
                    <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: active ? colors.white : colors.ink600 }}>{r.subjectName}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
            <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]}>{wiSubject}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <TextInput
                value={String(wiMark)}
                onChangeText={(v) => setWiMark(Math.min(100, Number(v.replace(/[^0-9]/g, '')) || 0))}
                keyboardType="number-pad"
                maxLength={3}
                style={{ minWidth: 52, textAlign: 'center', borderWidth: 1, borderColor: colors.brand, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 8, fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.brand, backgroundColor: colors.white }}
              />
              <Text style={{ fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.brand }}>%</Text>
            </View>
          </View>
          <Slider value={wiMark} min={0} max={100} step={1} onChange={setWiMark} />
          <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
            <View style={{ flex: 1, backgroundColor: colors.canvas, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' }}>
              <Text style={text.caption}>New APS</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Poppins_700Bold', color: whatIf.newAps > aps ? GREEN : colors.ink }}>{whatIf.newAps}</Text>
              <Text style={{ fontSize: 11, color: colors.ink400 }}>{whatIf.newAps > aps ? `▲ from ${aps}` : `was ${aps}`}</Text>
            </View>
            <View style={{ flex: 1, backgroundColor: colors.canvas, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' }}>
              <Text style={text.caption}>Universities</Text>
              <Text style={{ fontSize: 20, fontFamily: 'Poppins_700Bold', color: whatIf.progsNew > whatIf.progsNow ? GREEN : colors.ink }}>{whatIf.progsNew}/{career.programmes.length}</Text>
              <Text style={{ fontSize: 11, color: colors.ink400 }}>{whatIf.progsNew > whatIf.progsNow ? `▲ from ${whatIf.progsNow}` : 'open to you'}</Text>
            </View>
          </View>
        </Card>
      ) : null}

      {/* Study plan */}
      {unmet.length > 0 ? (
        <Card>
          <Text style={[text.section, { marginBottom: spacing.md }]}>Your Study Plan</Text>
          <View style={{ gap: spacing.sm }}>
            {unmet.map((r) => (
              <View key={r.subjectName} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Target color={colors.brand} size={16} />
                <Text style={[text.body, { color: colors.ink600, flex: 1 }]}>Raise {r.subjectName} by {r.minPercent - (markFor(r.subjectName) ?? 0)}% (to {r.minPercent}%)</Text>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.lg, backgroundColor: colors.canvas, borderRadius: radius.md, padding: spacing.md }}>
            <Text style={text.label}>Estimated time</Text>
            <Text style={{ fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.ink }}>{Math.round(months)} months</Text>
          </View>
        </Card>
      ) : null}

      {/* Universities */}
      <View>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Where to study it</Text>
        <View style={{ gap: spacing.md }}>
          {career.programmes.map((p) => {
            const met = aps >= p.minAps;
            return (
              <Card key={p.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                  <View style={{ flex: 1 }}>
                    <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]} numberOfLines={1}>{p.university}</Text>
                    <Text style={text.caption}>{p.programmeName} · APS {p.minAps}</Text>
                  </View>
                  {met ? (
                    <View style={{ backgroundColor: '#E7F6EC', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Check color={GREEN} size={14} /><Text style={{ fontSize: 12, fontFamily: 'Poppins_700Bold', color: GREEN }}>Eligible</Text>
                    </View>
                  ) : (
                    <View style={{ backgroundColor: colors.warn50, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Poppins_700Bold', color: colors.warn }}>+{p.minAps - aps} APS</Text>
                    </View>
                  )}
                </View>
              </Card>
            );
          })}
        </View>
      </View>

      <Text style={[text.caption, { textAlign: 'center' }]}>APS cut-offs are guidance estimates — confirm with each university.</Text>
    </Screen>
  );
}
