import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useApi } from '../src/lib/use-api';
import { Screen } from '../src/components/screen';
import { IconChip, ListRow, Loading, EmptyState, ErrorText, Badge } from '../src/components/ui';
import { Book, ChevronRight, Target } from '../src/components/icons';
import { colors, radius, spacing } from '../src/theme';
import type { SubjectTree } from '../src/lib/types';

export default function SubjectScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ subjectId: string; name?: string; grade?: string }>();
  const subjectId = params.subjectId;
  const { data: subject, loading, error } = useApi<SubjectTree>(
    subjectId ? `/curriculum/subjects/${subjectId}` : null,
  );

  return (
    <Screen
      title={params.name ?? subject?.name ?? 'Subject'}
      subtitle="Tap a topic to learn it with your tutor — one chat at a time."
      onBack={() => router.back()}
    >
      {loading ? <Loading label="Loading topics…" /> : null}
      {error ? <ErrorText message={error} /> : null}
      {subject && subject.topics.length === 0 ? (
        <EmptyState title="No topics yet" message="This subject's topics are being added." />
      ) : null}

      {subject ? (
        <View style={{ gap: spacing.md }}>
          {subject.topics.map((t, i) => (
            <View key={t.id} style={{ backgroundColor: colors.white, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line }}>
              <ListRow
                title={t.title}
                subtitle={`Topic ${i + 1}`}
                left={<IconChip tone="brand"><Book color={colors.brand} size={20} /></IconChip>}
                right={<ChevronRight color={colors.ink300} />}
                onPress={() =>
                  router.push({
                    pathname: '/learn',
                    params: {
                      topicId: t.id,
                      subjectId: subject.id,
                      topic: t.title,
                      subjectName: params.name ?? subject.name,
                    },
                  })
                }
              />
            </View>
          ))}
        </View>
      ) : null}
    </Screen>
  );
}
