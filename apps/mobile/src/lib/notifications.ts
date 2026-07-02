import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_KEY = 'passpath.dailyReminder';
const CHANNEL_ID = 'daily-reminders';
const REMINDER_HOUR = 16; // 4pm
const REMINDER_MINUTE = 0;

const MESSAGES = [
  'Your 3 topics are ready — keep your streak alive 🔥',
  '20 minutes today beats cramming later. Let’s go.',
  'Quick win: learn one topic and pass the check.',
  'Your future self says thanks. Do today’s revision.',
];
const pick = () => MESSAGES[Math.floor(Math.random() * MESSAGES.length)];

// expo-notifications runs a remote push-token auto-registration side-effect on
// import, which logs an error in Expo Go. We import it LAZILY (only when the
// student actually toggles reminders) so nothing fires at app startup.
let handlerSet = false;
async function getNotifications() {
  const N = await import('expo-notifications');
  if (!handlerSet) {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    handlerSet = true;
  }
  return N;
}

export async function isReminderEnabled(): Promise<boolean> {
  // Reads a flag only — never imports expo-notifications, so mounting the
  // Profile screen stays clean.
  return (await AsyncStorage.getItem(PREF_KEY)) === '1';
}

/** Turn the daily study reminder on (asks permission, schedules + sends a confirmation) or off. */
export async function setReminderEnabled(enabled: boolean): Promise<boolean> {
  const N = await getNotifications();
  if (!enabled) {
    await N.cancelAllScheduledNotificationsAsync();
    await AsyncStorage.setItem(PREF_KEY, '0');
    return false;
  }

  if (Platform.OS === 'android') {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Daily reminders',
      importance: N.AndroidImportance.HIGH,
    });
  }

  let { status } = await N.getPermissionsAsync();
  if (status !== 'granted') {
    status = (await N.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') {
    await AsyncStorage.setItem(PREF_KEY, '0');
    return false;
  }

  await N.cancelAllScheduledNotificationsAsync();
  // Recurring daily reminder at 4pm.
  await N.scheduleNotificationAsync({
    content: { title: 'PassPath', body: pick() },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: CHANNEL_ID,
    },
  });
  // Immediate confirmation so the student can see notifications actually fire.
  await N.scheduleNotificationAsync({
    content: { title: 'Reminders on ✅', body: 'You’ll get a nudge at 4pm to keep your streak.' },
    trigger: {
      type: N.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      channelId: CHANNEL_ID,
    },
  });

  await AsyncStorage.setItem(PREF_KEY, '1');
  return true;
}

/** Re-arm the reminder on app start if the student previously enabled it. */
export async function syncReminderOnLaunch(): Promise<void> {
  if (await isReminderEnabled()) {
    await setReminderEnabled(true);
  }
}
