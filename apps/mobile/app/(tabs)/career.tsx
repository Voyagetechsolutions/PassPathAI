import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { apiRequest } from '../../src/lib/api';
import { Screen } from '../../src/components/screen';
import { Card, ScoreRing, ProgressBar, Slider, InfoTip, SkeletonCard, ErrorText } from '../../src/components/ui';
import { Compass, GradCap, Target, TrendUp, Check, ChevronRight } from '../../src/components/icons';
import { SUBJECTS } from '../../src/lib/sa';
import { careerEmoji, computeAps, factsFor } from '../../src/lib/careers';
import { colors, radius, spacing, text } from '../../src/theme';
import type { CareerMatch, SubjectMark, ProfileSummary } from '../../src/lib/types';

const GREEN = '#16A34A';
const matchWord = (p: number) => (p >= 90 ? 'Excellent Match' : p >= 75 ? 'Strong Match' : p >= 55 ? 'Good Match' : 'Keep Building');

// Last-loaded hub data survives tab switches so returning renders instantly
// while a fresh copy loads quietly behind it.
let hubCache: { marks: Record<string, string>; recs: CareerMatch[] } | null = null;

export default function CareerTab() {
  const router = useRouter();
  const { token } = useAuth();
  const [marks, setMarks] = useState<Record<string, string>>(hubCache?.marks ?? {});
  const [results, setResults] = useState<CareerMatch[] | null>(hubCache?.recs ?? null);
  const [aps, setAps] = useState<number>(hubCache?.recs[0]?.computedAps ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(hubCache === null);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [search, setSearch] = useState('');

  // What-If state
  const [whatIfSubject, setWhatIfSubject] = useState<string | null>(null);
  const [whatIfMark, setWhatIfMark] = useState(60);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const [stored, recs] = await Promise.all([
          apiRequest<SubjectMark[]>('/profile/marks', { token }),
          apiRequest<CareerMatch[]>('/careers/recommended', { token }),
        ]);
        const markMap = Object.fromEntries(stored.map((m) => [m.subjectName, String(m.mark)]));
        hubCache = { marks: markMap, recs };
        setMarks(markMap);
        setResults(recs);
        setAps(recs[0]?.computedAps ?? 0);
        if (stored.length === 0) setEditOpen(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load your career hub.');
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const subjectNames = Object.keys(marks);
  const markPairs = useMemo(() => subjectNames.map((s) => ({ name: s, mark: Number(marks[s]) || 0 })), [marks, subjectNames]);
  const top = results?.[0] ?? null;
  const matchPct = top ? Math.round(top.admissionLikelihood * 100) : 0;

  // Lowest subject for "Improve your chances".
  const lowest = useMemo(() => [...markPairs].sort((a, b) => a.mark - b.mark)[0], [markPairs]);
  useEffect(() => { if (lowest && whatIfSubject === null) { setWhatIfSubject(lowest.name); setWhatIfMark(lowest.mark); } }, [lowest, whatIfSubject]);

  // What-If recompute
  const whatIf = useMemo(() => {
    if (!whatIfSubject || !results) return null;
    const newMarks = markPairs.map((m) => (m.name === whatIfSubject ? whatIfMark : m.mark));
    const newAps = computeAps(newMarks);
    const careersNow = results.filter((c) => c.programmes.some((p) => p.minAps <= aps)).length;
    const careersNew = results.filter((c) => c.programmes.some((p) => p.minAps <= newAps)).length;
    const unis = new Map<string, number>();
    for (const c of results) for (const p of c.programmes) if (!unis.has(p.university) || p.minAps < unis.get(p.university)!) unis.set(p.university, p.minAps);
    const uniNow = [...unis.values()].filter((m) => m <= aps).length;
    const uniNew = [...unis.values()].filter((m) => m <= newAps).length;
    return { newAps, careersNow, careersNew, uniNow, uniNew, totalUnis: unis.size };
  }, [whatIfSubject, whatIfMark, markPairs, results, aps]);

  async function save(next: Record<string, string>) {
    // Optimistic: close immediately and keep the current matches on screen
    // while the fresh ones compute — reopen with the error only if it fails.
    setEditOpen(false);
    setSaving(true);
    setError(null);
    try {
      const names = Object.keys(next);
      await apiRequest('/profile/marks', { method: 'PUT', token, body: { subjects: names.map((s) => ({ subjectName: s, mark: Number(next[s]) || 0 })) } });
      const recs = await apiRequest<CareerMatch[]>('/careers/recommended', { token });
      hubCache = { marks: next, recs };
      setResults(recs);
      setAps(recs[0]?.computedAps ?? 0);
      setWhatIfSubject(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update.');
      setEditOpen(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <Screen>
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
      </Screen>
    );

  const apsTone = aps >= 33 ? GREEN : aps >= 24 ? colors.warn : colors.danger;
  const apsBar = aps >= 33 ? 'emerald' : aps >= 24 ? 'warn' : 'danger';
  const facts = factsFor(top?.faculty);
  const unisForTop = top?.programmes ?? [];

  return (
    <Screen>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={text.h1}>Career Hub</Text>
          <Text style={[text.body, { marginTop: 2 }]}>Discover careers that match your strengths.</Text>
        </View>
        <Pressable onPress={() => setEditOpen(true)} hitSlop={8} style={({ pressed }) => [{ marginTop: 6 }, pressed && { opacity: 0.6 }]}>
          <Compass color={colors.ink600} size={24} />
        </Pressable>
      </View>

      {error ? <ErrorText message={error} /> : null}

      {subjectNames.length === 0 ? (
        <Card style={{ alignItems: 'center', gap: spacing.md }}>
          <Text style={text.title}>Let’s see where you’re headed</Text>
          <Text style={[text.body, { textAlign: 'center' }]}>Add your subjects and marks to unlock your career matches.</Text>
          <Pressable onPress={() => setEditOpen(true)} style={{ backgroundColor: GREEN, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: spacing.xl }}>
            <Text style={{ color: colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 15 }}>Add my subjects</Text>
          </Pressable>
        </Card>
      ) : (
        <>
          {/* Hero — career match */}
          <Card style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
            <Text style={[text.label, { alignSelf: 'flex-start' }]}>Your Career Match</Text>
            <View style={{ marginVertical: spacing.md }}>
              <ScoreRing value={matchPct} size={150} label={matchWord(matchPct)} />
            </View>
            <Text style={[text.caption, { textAlign: 'center', marginBottom: spacing.lg }]}>
              Based on your subjects and current marks{top ? ` — your strongest fit is ${top.title}.` : '.'}
            </Text>
            <Pressable onPress={() => top && router.push({ pathname: '/career-detail', params: { careerId: top.careerId } })} style={({ pressed }) => [{ backgroundColor: GREEN, borderRadius: radius.md, paddingVertical: 15, alignSelf: 'stretch', alignItems: 'center' }, pressed && { opacity: 0.9 }]}>
              <Text style={{ color: colors.white, fontFamily: 'Poppins_600SemiBold', fontSize: 16 }}>Explore Careers</Text>
            </Pressable>
          </Card>

          {/* Current subjects */}
          <Card>
            <Text style={[text.label, { marginBottom: spacing.md }]}>Current Subjects</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {subjectNames.map((s) => (
                <View key={s} style={{ backgroundColor: colors.navy50, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
                  <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.navy }}>{s}{marks[s] ? ` · ${marks[s]}%` : ''}</Text>
                </View>
              ))}
            </View>
          </Card>

          {/* Current APS */}
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={text.label}>Current APS</Text>
                  <InfoTip
                    title="APS — Admission Point Score"
                    tip="Universities convert your best 6 subjects (Life Orientation counts less) into points: 80%+ = 7 points, 70–79% = 6, 60–69% = 5, and so on. Each degree asks for a minimum APS. Raise a subject one band and your APS goes up."
                  />
                </View>
                <Text style={{ fontSize: 48, fontFamily: 'Poppins_700Bold', color: colors.ink, letterSpacing: -1 }}>{aps}</Text>
              </View>
              <Text style={{ fontSize: 13, fontFamily: 'Poppins_700Bold', color: apsTone, marginBottom: spacing.md }}>
                {aps >= 33 ? 'Degree eligible' : aps >= 24 ? 'Close' : 'Build it up'}
              </Text>
            </View>
            <Text style={[text.caption, { marginBottom: spacing.sm }]}>Estimated university eligibility</Text>
            <ProgressBar value={Math.min(100, (aps / 42) * 100)} tone={apsBar as 'emerald' | 'warn' | 'danger'} />
          </Card>

          {/* Recommended careers */}
          <View>
            <Text style={[text.section, { marginBottom: spacing.md }]}>Recommended Careers</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
              {(results ?? []).slice(0, 12).map((c) => {
                const p = Math.round(c.admissionLikelihood * 100);
                const minAps = c.programmes.length ? Math.min(...c.programmes.map((x) => x.minAps)) : null;
                return (
                  <Pressable key={c.careerId} onPress={() => router.push({ pathname: '/career-detail', params: { careerId: c.careerId } })} style={({ pressed }) => [{ width: 168 }, pressed && { opacity: 0.85 }]}>
                    <View style={{ backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, padding: spacing.lg, minHeight: 188, justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 34 }}>{careerEmoji(c.title, c.faculty)}</Text>
                      <View>
                        <Text style={{ fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.ink }} numberOfLines={2}>{c.title}</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Poppins_700Bold', color: c.eligible ? GREEN : colors.warn, marginTop: 4 }}>{p}% Match</Text>
                        {minAps !== null ? <Text style={[text.caption, { marginTop: 2 }]}>From APS {minAps}</Text> : null}
                      </View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: spacing.sm }}>
                        <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: colors.brand }}>Learn more</Text>
                        <ChevronRight color={colors.brand} size={16} />
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {/* Find any career by name */}
          <View>
            <Text style={[text.section, { marginBottom: spacing.md }]}>Find a Career</Text>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="e.g. Doctor, Software, Lawyer…"
              placeholderTextColor={colors.ink300}
              style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.ink }}
            />
            {search.trim().length >= 2 ? (
              <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
                {(results ?? [])
                  .filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()) || (c.faculty ?? '').toLowerCase().includes(search.trim().toLowerCase()))
                  .slice(0, 6)
                  .map((c) => (
                    <Pressable key={c.careerId} onPress={() => { setSearch(''); router.push({ pathname: '/career-detail', params: { careerId: c.careerId } }); }} style={({ pressed }) => [{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md }, pressed && { opacity: 0.7 }]}>
                      <Text style={{ fontSize: 22 }}>{careerEmoji(c.title, c.faculty)}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]} numberOfLines={1}>{c.title}</Text>
                        <Text style={text.caption} numberOfLines={1}>{c.faculty ?? ''} · {Math.round(c.admissionLikelihood * 100)}% match</Text>
                      </View>
                      <ChevronRight color={colors.ink300} size={18} />
                    </Pressable>
                  ))}
                {(results ?? []).filter((c) => c.title.toLowerCase().includes(search.trim().toLowerCase()) || (c.faculty ?? '').toLowerCase().includes(search.trim().toLowerCase())).length === 0 ? (
                  <Text style={[text.caption, { textAlign: 'center', paddingVertical: spacing.md }]}>
                    Not in our database yet — we cover 100 careers and add more all the time. Ask your tutor about it in the meantime!
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>

          {/* Universities you qualify for */}
          {unisForTop.length > 0 ? (
            <View>
              <Text style={[text.section, { marginBottom: spacing.md }]}>Universities · {top?.title}</Text>
              <View style={{ gap: spacing.md }}>
                {unisForTop.slice(0, 6).map((p) => {
                  const gap = p.minAps - aps;
                  return (
                    <Pressable key={`${p.university}-${p.programmeName}`} onPress={() => top && router.push({ pathname: '/career-detail', params: { careerId: top.careerId } })} style={({ pressed }) => [pressed && { opacity: 0.7 }]}>
                      <Card>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                          <View style={{ flex: 1 }}>
                            <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]} numberOfLines={1}>{p.university}</Text>
                            <Text style={text.caption}>{p.programmeName} · APS {p.minAps}</Text>
                          </View>
                          {p.apsMet ? (
                            <View style={{ backgroundColor: '#E7F6EC', borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                              <Check color={GREEN} size={14} />
                              <Text style={{ fontSize: 12, fontFamily: 'Poppins_700Bold', color: GREEN }}>Eligible</Text>
                            </View>
                          ) : (
                            <View style={{ backgroundColor: colors.warn50, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 5 }}>
                              <Text style={{ fontSize: 12, fontFamily: 'Poppins_700Bold', color: colors.warn }}>+{gap} APS</Text>
                            </View>
                          )}
                        </View>
                      </Card>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {/* What If? simulator */}
          {whatIf && whatIfSubject ? (
            <Card style={{ borderColor: colors.brand, borderWidth: 1.5 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
                <TrendUp color={colors.brand} size={20} />
                <Text style={text.title}>What if…?</Text>
              </View>
              <Text style={[text.caption, { marginBottom: spacing.md }]}>Drag to see what improving one subject unlocks.</Text>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, marginBottom: spacing.md }}>
                {markPairs.map((m) => {
                  const active = whatIfSubject === m.name;
                  return (
                    <Pressable key={m.name} onPress={() => { setWhatIfSubject(m.name); setWhatIfMark(m.mark); }} style={{ paddingHorizontal: spacing.md, paddingVertical: 7, borderRadius: radius.pill, borderWidth: 1, borderColor: active ? colors.brand : colors.line, backgroundColor: active ? colors.brand : colors.white }}>
                      <Text style={{ fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: active ? colors.white : colors.ink600 }}>{m.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]}>{whatIfSubject}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <TextInput
                    value={String(whatIfMark)}
                    onChangeText={(v) => setWhatIfMark(Math.min(100, Number(v.replace(/[^0-9]/g, '')) || 0))}
                    keyboardType="number-pad"
                    maxLength={3}
                    style={{ minWidth: 52, textAlign: 'center', borderWidth: 1, borderColor: colors.brand, borderRadius: radius.sm, paddingVertical: 5, paddingHorizontal: 8, fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.brand, backgroundColor: colors.white }}
                  />
                  <Text style={{ fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.brand }}>%</Text>
                </View>
              </View>
              <Slider value={whatIfMark} min={0} max={100} step={1} onChange={setWhatIfMark} />

              <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.md }}>
                <WhatIfStat label="APS" from={aps} to={whatIf.newAps} />
                <WhatIfStat label="Universities" from={whatIf.uniNow} to={whatIf.uniNew} suffix={`/${whatIf.totalUnis}`} />
                <WhatIfStat label="Careers" from={whatIf.careersNow} to={whatIf.careersNew} />
              </View>
            </Card>
          ) : null}

          {/* Improve your chances */}
          {lowest ? (
            <Card style={{ backgroundColor: colors.navy }}>
              <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: 'rgba(255,255,255,0.7)' }}>IMPROVE YOUR CHANCES</Text>
              <Text style={{ fontSize: 19, fontFamily: 'Poppins_700Bold', color: colors.white, marginTop: 4 }}>Lift {lowest.name} to 70%</Text>
              <View style={{ flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md }}>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Current</Text>
                  <Text style={{ color: colors.white, fontSize: 22, fontFamily: 'Poppins_700Bold' }}>{lowest.mark}%</Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>Target</Text>
                  <Text style={{ color: colors.white, fontSize: 22, fontFamily: 'Poppins_700Bold' }}>70%</Text>
                </View>
                <View>
                  <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>APS gain</Text>
                  <Text style={{ color: '#7CE2A8', fontSize: 22, fontFamily: 'Poppins_700Bold' }}>
                    +{Math.max(0, computeAps(markPairs.map((m) => (m.name === lowest.name ? 70 : m.mark))) - aps)}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => router.push('/study')} style={({ pressed }) => [{ backgroundColor: colors.white, borderRadius: radius.md, paddingVertical: 13, alignItems: 'center', marginTop: spacing.lg }, pressed && { opacity: 0.9 }]}>
                <Text style={{ color: colors.navy, fontFamily: 'Poppins_700Bold', fontSize: 15 }}>Start Improvement Plan</Text>
              </Pressable>
            </Card>
          ) : null}

          {/* Career timeline */}
          {top ? (
            <Card>
              <Text style={[text.section, { marginBottom: spacing.lg }]}>Your Path</Text>
              <Timeline steps={['Today', `Improve ${lowest?.name ?? 'a subject'}`, `Reach APS ${Math.max(aps + 2, 30)}`, 'Apply to university', 'Receive your offer', 'Graduate', `Become a ${top.title}`]} />
            </Card>
          ) : null}

          {/* Daily motivation — concrete outcomes */}
          {top ? (
            <Card>
              <Text style={[text.label, { marginBottom: spacing.md }]}>Why {top.title} is worth it</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <FactStat label="Typical salary" value={facts.salary} tone={GREEN} />
                <FactStat label="Demand" value={facts.demand} tone={colors.brand} />
                <FactStat label="Outlook" value={facts.outlook} tone={colors.warn} />
              </View>
              <Text style={[text.caption, { marginTop: spacing.md }]}>Ranges are typical SA guidance — actual pay varies by employer and experience.</Text>
            </Card>
          ) : null}
        </>
      )}

      <MarksModal
        visible={editOpen}
        marks={marks}
        setMarks={setMarks}
        saving={saving}
        onSave={save}
        onClose={() => setEditOpen(false)}
      />
    </Screen>
  );
}

function WhatIfStat({ label, from, to, suffix }: { label: string; from: number; to: number; suffix?: string }) {
  const up = to > from;
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, borderRadius: radius.md, padding: spacing.md, alignItems: 'center' }}>
      <Text style={text.caption}>{label}</Text>
      <Text style={{ fontSize: 18, fontFamily: 'Poppins_700Bold', color: up ? GREEN : colors.ink, marginTop: 2 }}>{to}{suffix ?? ''}</Text>
      <Text style={{ fontSize: 11, color: colors.ink400 }}>{up ? `▲ from ${from}` : `was ${from}`}</Text>
    </View>
  );
}

function FactStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas, borderRadius: radius.md, padding: spacing.md }}>
      <Text style={{ fontSize: 15, fontFamily: 'Poppins_700Bold', color: tone }}>{value}</Text>
      <Text style={[text.caption, { marginTop: 4 }]}>{label}</Text>
    </View>
  );
}

function Timeline({ steps }: { steps: string[] }) {
  return (
    <View>
      {steps.map((s, i) => {
        const isLast = i === steps.length - 1;
        const isFirst = i === 0;
        return (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ alignItems: 'center', width: 22 }}>
              <View style={{ width: isFirst || isLast ? 16 : 11, height: isFirst || isLast ? 16 : 11, borderRadius: 8, backgroundColor: isLast ? GREEN : isFirst ? colors.brand : colors.white, borderWidth: 2, borderColor: isLast ? GREEN : colors.brand }} />
              {!isLast ? <View style={{ width: 2, flex: 1, minHeight: 22, backgroundColor: colors.line }} /> : null}
            </View>
            <Text style={{ flex: 1, fontSize: 14, lineHeight: 20, color: isFirst || isLast ? colors.ink : colors.ink600, fontFamily: isFirst || isLast ? 'Poppins_700Bold' : 'Poppins_500Medium', paddingBottom: isLast ? 0 : spacing.lg }}>{s}</Text>
          </View>
        );
      })}
    </View>
  );
}

function MarksModal({ visible, marks, setMarks, saving, onSave, onClose }: {
  visible: boolean;
  marks: Record<string, string>;
  setMarks: (fn: (m: Record<string, string>) => Record<string, string>) => void;
  saving: boolean;
  onSave: (next: Record<string, string>) => void;
  onClose: () => void;
}) {
  const subjects = Object.keys(marks);
  const available = SUBJECTS.filter((s) => !(s in marks));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl, maxHeight: '88%' }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: spacing.lg }} />
          <Text style={[text.h2, { fontSize: 19, marginBottom: spacing.md }]}>Your subjects & marks</Text>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
              {subjects.map((s) => (
                <View key={s} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Pressable onPress={() => setMarks((m) => { const n = { ...m }; delete n[s]; return n; })} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
                    <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: colors.ink400, fontSize: 15 }}>×</Text></View>
                    <Text style={[text.body, { color: colors.ink }]}>{s}</Text>
                  </Pressable>
                  <TextInput value={marks[s]} onChangeText={(v) => setMarks((m) => ({ ...m, [s]: v.replace(/[^0-9]/g, '').slice(0, 3) }))} keyboardType="number-pad" placeholder="%" placeholderTextColor={colors.ink300} style={{ width: 56, textAlign: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingVertical: 8, fontSize: 15, color: colors.ink, backgroundColor: colors.white }} />
                </View>
              ))}
            </View>
            {available.length > 0 ? (
              <View>
                <Text style={[text.label, { marginBottom: 6 }]}>Add a subject</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {available.map((s) => (
                    <Pressable key={s} onPress={() => setMarks((m) => ({ ...m, [s]: '' }))} style={{ borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 7 }}>
                      <Text style={{ color: colors.ink600, fontSize: 12, fontFamily: 'Poppins_600SemiBold' }}>+ {s}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
          </ScrollView>
          <Pressable onPress={() => onSave(marks)} disabled={saving || subjects.length === 0} style={{ marginTop: spacing.lg, backgroundColor: subjects.length === 0 ? colors.ink300 : colors.navy, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>{saving ? 'Updating…' : 'Save & update matches'}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Text style={[text.caption, { color: colors.ink400 }]}>Close</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
