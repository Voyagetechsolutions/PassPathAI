import { Redirect, Tabs } from 'expo-router';
import { useAuth } from '../../src/lib/auth';
import { useApi } from '../../src/lib/use-api';
import { Loading } from '../../src/components/ui';
import { Home, Book, Clipboard, Compass, User } from '../../src/components/icons';
import { colors } from '../../src/theme';
import type { ProfileSummary } from '../../src/lib/types';

export default function TabsLayout() {
  const { profile, loading } = useAuth();
  const isStudent = profile?.role === 'student';
  const { data: me, loading: meLoading } = useApi<ProfileSummary>(isStudent ? '/profile/me' : null);

  if (loading) return <Loading label="Loading…" />;
  if (!profile) return <Redirect href="/login" />;
  // Send students who haven't finished onboarding to the wizard.
  if (isStudent) {
    if (meLoading || !me) return <Loading label="Loading your profile…" />;
    if (!me.onboarded) return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.navy,
        tabBarInactiveTintColor: colors.ink300,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.line,
          borderTopWidth: 1,
          height: 62,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: 'Poppins_600SemiBold' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Home color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="study"
        options={{ title: 'Study', tabBarIcon: ({ color }) => <Book color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="exams"
        options={{ title: 'Exams', tabBarIcon: ({ color }) => <Clipboard color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="career"
        options={{ title: 'Career', tabBarIcon: ({ color }) => <Compass color={color} size={22} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <User color={color} size={22} /> }}
      />
    </Tabs>
  );
}
