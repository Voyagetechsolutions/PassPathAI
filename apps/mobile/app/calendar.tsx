import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { useApi } from '../src/lib/use-api';
import { Screen } from '../src/components/screen';
import { Card, IconChip } from '../src/components/ui';
import { Book, Clock, ChevronRight, Check } from '../src/components/icons';
import { colors, radius, spacing, text } from '../src/theme';
import type { CalendarMonth, CalendarExam, ProfileSummary } from '../src/lib/types';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const pad = (n: number) => String(n).padStart(2, '0');
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;
const todayStr = ymd(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

export default function CalendarScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { data: me } = useApi<ProfileSummary>('/profile/me');

  const [cursor, setCursor] = useState(() => { const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }; });
  const [data, setData] = useState<CalendarMonth | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(todayStr);
  const [showAdd, setShowAdd] = useState(false);

  const monthParam = `${cursor.year}-${pad(cursor.month + 1)}`;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d = await apiRequest<CalendarMonth>(`/calendar?month=${monthParam}`, { token });
      setData(d);
    } catch {
      setData({ month: monthParam, learned: [], exams: [] });
    } finally {
      setLoading(false);
    }
  }, [monthParam, token]);

  useEffect(() => { void load(); }, [load]);

  const learnedDates = useMemo(() => new Set((data?.learned ?? []).map((l) => l.date)), [data]);
  const examDates = useMemo(() => new Set((data?.exams ?? []).map((e) => e.date)), [data]);

  const selectedLearned = data?.learned.find((l) => l.date === selected);
  const selectedExams = (data?.exams ?? []).filter((e) => e.date === selected);

  const cells = useMemo(() => buildCells(cursor.year, cursor.month), [cursor]);

  function shift(delta: number) {
    setSelected(null);
    setCursor((c) => {
      const m = c.month + delta;
      return { year: c.year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 };
    });
  }

  async function removeExam(id: string) {
    try {
      await apiRequest(`/calendar/exams/${id}`, { method: 'DELETE', token });
      await load();
    } catch { /* ignore */ }
  }

  return (
    <Screen title="Calendar" subtitle="What you’ve learnt, and what’s coming up." onBack={() => router.back()}>
      {/* Month navigation */}
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
          <Pressable onPress={() => shift(-1)} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <View style={{ transform: [{ rotate: '180deg' }] }}><ChevronRight color={colors.ink400} size={22} /></View>
          </Pressable>
          <Text style={{ fontSize: 16, fontFamily: 'Poppins_700Bold', color: colors.ink }}>{MONTHS[cursor.month]} {cursor.year}</Text>
          <Pressable onPress={() => shift(1)} hitSlop={10} style={({ pressed }) => pressed && { opacity: 0.5 }}>
            <ChevronRight color={colors.ink400} size={22} />
          </Pressable>
        </View>

        {/* Weekday header */}
        <View style={{ flexDirection: 'row' }}>
          {WEEKDAYS.map((w, i) => (
            <Text key={i} style={{ flex: 1, textAlign: 'center', fontSize: 11, fontFamily: 'Poppins_600SemiBold', color: colors.ink300 }}>{w}</Text>
          ))}
        </View>

        {/* Day grid */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing.sm }}>
          {cells.map((day, i) => {
            if (day === null) return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
            const ds = ymd(cursor.year, cursor.month, day);
            const isSel = selected === ds;
            const isToday = ds === todayStr;
            const learnt = learnedDates.has(ds);
            const exam = examDates.has(ds);
            return (
              <Pressable key={i} onPress={() => setSelected(ds)} style={{ width: `${100 / 7}%`, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                <View style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: isSel ? colors.navy : isToday ? colors.navy50 : 'transparent' }}>
                  <Text style={{ fontSize: 14, fontFamily: isToday || isSel ? 'Poppins_700Bold' : 'Poppins_400Regular', color: isSel ? colors.white : colors.ink }}>{day}</Text>
                </View>
                <View style={{ flexDirection: 'row', gap: 3, height: 6, marginTop: 1 }}>
                  {learnt ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.emerald }} /> : null}
                  {exam ? <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: colors.warn }} /> : null}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* Legend */}
        <View style={{ flexDirection: 'row', gap: spacing.lg, marginTop: spacing.sm, justifyContent: 'center' }}>
          <Legend color={colors.emerald} label="Learnt" />
          <Legend color={colors.warn} label="Exam" />
        </View>
      </Card>

      {loading ? <ActivityIndicator color={colors.brand} /> : null}

      {/* Selected-day detail */}
      {selected ? (
        <View style={{ gap: spacing.md }}>
          <Text style={text.section}>{formatLong(selected)}</Text>

          {selectedExams.length > 0 ? (
            <Card style={{ borderColor: colors.warn, borderWidth: 1 }}>
              <Text style={[text.label, { marginBottom: spacing.sm }]}>Exams</Text>
              <View style={{ gap: spacing.sm }}>
                {selectedExams.map((e) => (
                  <ExamRow key={e.id} exam={e} onRemove={() => removeExam(e.id)} />
                ))}
              </View>
            </Card>
          ) : null}

          {selectedLearned && selectedLearned.topics.length > 0 ? (
            <Card>
              <Text style={[text.label, { marginBottom: spacing.sm }]}>Learnt this day</Text>
              <View style={{ gap: spacing.sm }}>
                {selectedLearned.topics.map((t) => (
                  <View key={t.topicId} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <IconChip tone="emerald"><Check color={colors.emerald} size={16} /></IconChip>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_500Medium' }]}>{t.title}</Text>
                      <Text style={text.caption}>{t.subjectName}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>
          ) : selectedExams.length === 0 ? (
            <Card style={{ alignItems: 'center' }}>
              <Text style={[text.caption, { textAlign: 'center' }]}>
                {selected >= todayStr ? 'Nothing yet for this day.' : 'No lessons recorded on this day.'}
              </Text>
            </Card>
          ) : null}

          <Pressable onPress={() => setShowAdd(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, backgroundColor: colors.navy, borderRadius: radius.md, paddingVertical: 13 }, pressed && { opacity: 0.85 }]}>
            <Clock color={colors.white} size={18} />
            <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>Add an exam on this day</Text>
          </Pressable>
        </View>
      ) : null}

      <AddExamModal
        visible={showAdd}
        dateStr={selected}
        subjects={me?.subjects ?? []}
        token={token}
        onClose={() => setShowAdd(false)}
        onAdded={() => { setShowAdd(false); void load(); }}
      />
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
      <Text style={text.caption}>{label}</Text>
    </View>
  );
}

function ExamRow({ exam, onRemove }: { exam: CalendarExam; onRemove: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <IconChip tone="warn"><Clock color={colors.warn} size={16} /></IconChip>
      <View style={{ flex: 1 }}>
        <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_500Medium' }]}>{exam.title}</Text>
        {exam.subjectName ? <Text style={text.caption}>{exam.subjectName}</Text> : null}
      </View>
      {exam.editable ? (
        <Pressable onPress={onRemove} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.5 }}>
          <Text style={{ fontSize: 18, color: colors.ink300 }}>×</Text>
        </Pressable>
      ) : (
        <Text style={[text.caption, { color: colors.ink300 }]}>official</Text>
      )}
    </View>
  );
}

function AddExamModal({
  visible,
  dateStr,
  subjects,
  token,
  onClose,
  onAdded,
}: {
  visible: boolean;
  dateStr: string | null;
  subjects: ProfileSummary['subjects'];
  token: string | null;
  onClose: () => void;
  onAdded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function reset() { setTitle(''); setSubjectId(null); setErr(null); setBusy(false); }

  async function save() {
    if (!dateStr || title.trim().length < 2 || busy) return;
    setBusy(true);
    setErr(null);
    try {
      await apiRequest('/calendar/exams', { method: 'POST', token, body: { title: title.trim(), date: dateStr, subjectId: subjectId ?? undefined } });
      reset();
      onAdded();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not add that exam.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { reset(); onClose(); }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' }}>
        <View style={{ backgroundColor: colors.canvas, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg, paddingBottom: spacing.xl }}>
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: spacing.lg }} />
          <Text style={[text.h2, { fontSize: 19, marginBottom: 4 }]}>Add an exam</Text>
          <Text style={[text.caption, { marginBottom: spacing.lg }]}>{dateStr ? formatLong(dateStr) : ''}</Text>

          <Text style={[text.label, { marginBottom: spacing.sm }]}>What’s the exam?</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Mathematics Paper 1"
            placeholderTextColor={colors.ink300}
            style={{ backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, fontSize: 15, color: colors.ink }}
          />

          {subjects.length > 0 ? (
            <>
              <Text style={[text.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>Subject (optional)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {subjects.map((s) => {
                  const active = subjectId === s.id;
                  return (
                    <Pressable key={s.id} onPress={() => setSubjectId(active ? null : s.id)} style={{ borderWidth: 1, borderColor: active ? colors.navy : colors.line, backgroundColor: active ? colors.navy : colors.white, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: 8 }}>
                      <Text style={{ fontSize: 13, fontFamily: 'Poppins_600SemiBold', color: active ? colors.white : colors.ink600 }}>{s.name}</Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          {err ? <Text style={[text.body, { color: colors.danger, marginTop: spacing.md }]}>{err}</Text> : null}

          <Pressable onPress={save} disabled={busy || title.trim().length < 2} style={{ marginTop: spacing.xl, backgroundColor: title.trim().length < 2 ? colors.ink300 : colors.navy, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: colors.white, fontSize: 15, fontFamily: 'Poppins_600SemiBold' }}>{busy ? 'Saving…' : 'Save exam'}</Text>
          </Pressable>
          <Pressable onPress={() => { reset(); onClose(); }} style={{ marginTop: spacing.md, alignItems: 'center' }}>
            <Text style={[text.caption, { color: colors.ink400 }]}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function buildCells(year: number, month: number): Array<number | null> {
  const first = new Date(year, month, 1).getDay(); // 0=Sun
  const lead = (first + 6) % 7; // Monday-start
  const days = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function formatLong(ds: string): string {
  const [y, m, d] = ds.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
