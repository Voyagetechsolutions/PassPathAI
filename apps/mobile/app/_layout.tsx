import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { AuthProvider } from '../src/lib/auth';
import { colors } from '../src/theme';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });
  if (!fontsLoaded) {
    return null;
  }
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.canvas } }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="welcome" />
          <Stack.Screen name="login" />
          <Stack.Screen name="register" options={{ presentation: 'card' }} />
          <Stack.Screen name="onboarding" options={{ presentation: 'card', gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="tutor" options={{ presentation: 'card' }} />
          <Stack.Screen name="subject" options={{ presentation: 'card' }} />
          <Stack.Screen name="learn" options={{ presentation: 'card' }} />
          <Stack.Screen name="practice" options={{ presentation: 'card' }} />
          <Stack.Screen name="calendar" options={{ presentation: 'card' }} />
          <Stack.Screen name="premium" options={{ presentation: 'modal' }} />
          <Stack.Screen name="career-detail" options={{ presentation: 'card' }} />
          <Stack.Screen name="past-papers" options={{ presentation: 'card' }} />
          <Stack.Screen name="exam-paper" options={{ presentation: 'card', gestureEnabled: false }} />
          <Stack.Screen name="admin-stats" options={{ presentation: 'card' }} />
          <Stack.Screen name="quiz" options={{ presentation: 'card', gestureEnabled: false }} />
        </Stack>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
