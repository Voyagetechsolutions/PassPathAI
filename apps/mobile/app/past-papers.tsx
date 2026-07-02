import { Linking, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useApi } from '../src/lib/use-api';
import { API_BASE_URL } from '../src/lib/config';
import { Screen } from '../src/components/screen';
import { Card, IconChip, ListRow, Badge, Loading, EmptyState, ErrorText } from '../src/components/ui';
import { Clipboard, ChevronRight } from '../src/components/icons';
import { colors, spacing } from '../src/theme';
import type { PastPaper } from '../src/lib/types';

export default function PastPapersScreen() {
  const router = useRouter();
  const { data, loading, error } = useApi<PastPaper[]>('/past-papers?mine=true');

  function open(p: PastPaper) {
    void Linking.openURL(`${API_BASE_URL}${p.fileUrl}`);
  }

  if (loading) return <Screen onBack={() => router.back()}><Loading label="Loading past papers…" /></Screen>;
  if (error) return <Screen onBack={() => router.back()}><ErrorText message={error} /></Screen>;

  // Group by subject for clean section headers.
  const groups = new Map<string, PastPaper[]>();
  for (const p of data ?? []) {
    const key = p.subject?.name ?? 'General';
    const list = groups.get(key) ?? [];
    list.push(p);
    groups.set(key, list);
  }

  return (
    <Screen title="Past papers" subtitle="Download exam papers and memos to practise with." onBack={() => router.back()}>
      {!data || data.length === 0 ? (
        <EmptyState title="No past papers yet" message="Papers added by your school will appear here." />
      ) : (
        [...groups.entries()].map(([subject, papers]) => (
          <View key={subject}>
            <Text style={[{ marginBottom: spacing.md }, { fontSize: 12, fontFamily: 'Poppins_600SemiBold', color: colors.ink400, letterSpacing: 0.6 }]}>
              {subject.toUpperCase()}
            </Text>
            <View style={{ gap: spacing.md, marginBottom: spacing.lg }}>
              {papers.map((p) => (
                <Card key={p.id}>
                  <ListRow
                    title={p.title}
                    subtitle={`${p.year} · ${p.kind}`}
                    left={<IconChip tone={p.kind === 'Memo' ? 'emerald' : 'navy'}><Clipboard color={p.kind === 'Memo' ? colors.emerald : colors.navy} size={20} /></IconChip>}
                    right={
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        <Badge tone="muted">Open</Badge>
                        <ChevronRight color={colors.ink300} />
                      </View>
                    }
                    onPress={() => open(p)}
                  />
                </Card>
              ))}
            </View>
          </View>
        ))
      )}
    </Screen>
  );
}
