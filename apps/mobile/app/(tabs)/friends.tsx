import { useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../../src/components/screen';
import { Badge, Card, EmptyState, ErrorText, Loading, PrimaryButton, SecondaryButton } from '../../src/components/ui';
import { Flame, Users } from '../../src/components/icons';
import { apiRequest } from '../../src/lib/api';
import { useAuth } from '../../src/lib/auth';
import { useApi } from '../../src/lib/use-api';
import { colors, radius, spacing, text } from '../../src/theme';

interface Person { id: string; firstName: string; surname: string; email: string }
interface SocialSummary {
  studiedToday: boolean;
  rewardPoints: number;
  rewards: Array<{ id: string; title: string; description: string; icon: string; points: number; earnedAt: string }>;
  pending: Array<{ id: string; friend: Person }>;
  friends: Array<{ id: string; friend: Person; streak: { currentStreak: number; longestStreak: number } | null; lastMessage: { content: string } | null }>;
}

export default function FriendsTab() {
  const router = useRouter();
  const { token } = useAuth();
  const { data, loading, error, reload } = useApi<SocialSummary>('/social/summary');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function action(path: string, method = 'POST', body?: unknown) {
    setBusy(true); setActionError(null);
    try { await apiRequest(path, { method, token, body }); reload(); }
    catch (e) { setActionError(e instanceof Error ? e.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }

  if (loading) return <Screen><Loading label="Loading your study circle…" /></Screen>;
  if (error) return <Screen><ErrorText message={error} /></Screen>;

  return (
    <Screen title="Study together" subtitle="Keep a streak, motivate each other, and earn rewards.">
      {actionError ? <ErrorText message={actionError} /> : null}
      <Card style={{ backgroundColor: colors.navy, borderColor: colors.navy }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
          <View style={{ width: 48, height: 48, borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' }}>
            <Flame color={colors.white} size={26} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.white, fontSize: 18, fontFamily: 'Poppins_700Bold' }}>{data?.rewardPoints ?? 0} points</Text>
            <Text style={{ color: 'rgba(255,255,255,0.78)', fontSize: 13 }}>Your study rewards balance</Text>
          </View>
        </View>
        <View style={{ marginTop: spacing.lg }}>
          <PrimaryButton label={data?.studiedToday ? 'Studied today ✓' : 'Check in today'} disabled={busy || data?.studiedToday} onPress={() => action('/social/check-in', 'POST', { minutes: 25 })} />
        </View>
      </Card>

      <View>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Rewards</Text>
        {data?.rewards.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.md }}>
            {data.rewards.map((reward) => (
              <Card key={reward.id} style={{ width: 165 }}>
                <Text style={{ fontSize: 30 }}>{reward.icon}</Text>
                <Text style={[text.title, { marginTop: spacing.sm }]}>{reward.title}</Text>
                <Text style={text.caption}>{reward.description}</Text>
                <View style={{ marginTop: spacing.sm }}><Badge tone="emerald">+{reward.points} pts</Badge></View>
              </Card>
            ))}
          </ScrollView>
        ) : <EmptyState title="Your first reward is close" message="Check in after a study session to unlock it." />}
      </View>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md }}>
          <Users color={colors.brand} /><Text style={text.title}>Add a study friend</Text>
        </View>
        <TextInput value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="friend@email.com" placeholderTextColor={colors.ink300}
          style={{ borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.ink, marginBottom: spacing.md }} />
        <SecondaryButton label={busy ? 'Sending…' : 'Send friend request'} disabled={busy || !email.trim()} onPress={async () => { await action('/social/friends', 'POST', { email: email.trim() }); setEmail(''); }} />
      </Card>

      {data?.pending.map((request) => (
        <Card key={request.id}>
          <Text style={text.title}>{request.friend.firstName} wants to study with you</Text>
          <Text style={text.caption}>{request.friend.email}</Text>
          <View style={{ marginTop: spacing.md }}><PrimaryButton label="Accept" disabled={busy} onPress={() => action(`/social/friends/${request.id}/accept`, 'PATCH')} /></View>
        </Card>
      ))}

      <View>
        <Text style={[text.section, { marginBottom: spacing.md }]}>Your study circle</Text>
        {!data?.friends.length ? <EmptyState title="No friends yet" message="Add a classmate by email and start a shared study streak." /> : (
          <View style={{ gap: spacing.md }}>
            {data.friends.map((item) => (
              <Pressable key={item.id} onPress={() => router.push({ pathname: '/friend-chat', params: { friendshipId: item.id, name: item.friend.firstName } })}>
                <Card>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: colors.brand, fontFamily: 'Poppins_700Bold', fontSize: 17 }}>{item.friend.firstName[0]}{item.friend.surname[0]}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={text.title}>{item.friend.firstName} {item.friend.surname}</Text>
                      <Text numberOfLines={1} style={text.caption}>{item.lastMessage?.content ?? 'Start a study chat'}</Text>
                    </View>
                    <Badge tone="warn">🔥 {item.streak?.currentStreak ?? 0}</Badge>
                  </View>
                </Card>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </Screen>
  );
}
