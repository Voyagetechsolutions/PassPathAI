import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREF_KEY = 'passpath.dailyReminder';
const EXAMS_KEY = 'passpath.examReminderDates';
const CHANNEL_ID = 'daily-reminders';
const REMINDER_HOUR = 16; // 4pm
const REMINDER_MINUTE = 0;

interface ExamEntry {
  title: string;
  date: string; // YYYY-MM-DD
}

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

  await rescheduleAll(N);
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

/** Cancel everything, then schedule the daily nudge + all exam countdowns. */
async function rescheduleAll(N: Awaited<ReturnType<typeof getNotifications>>): Promise<void> {
  await N.cancelAllScheduledNotificationsAsync();
  await N.scheduleNotificationAsync({
    content: { title: 'PassPath', body: pick() },
    trigger: {
      type: N.SchedulableTriggerInputTypes.DAILY,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
      channelId: CHANNEL_ID,
    },
  });
  await scheduleExamNotifications(N);
}

async function readExams(): Promise<ExamEntry[]> {
  try {
    return JSON.parse((await AsyncStorage.getItem(EXAMS_KEY)) ?? '[]') as ExamEntry[];
  } catch {
    return [];
  }
}

/** Countdown nudges: one week before (4pm) and the day before (7am) each exam. */
async function scheduleExamNotifications(N: Awaited<ReturnType<typeof getNotifications>>): Promise<void> {
  const now = Date.now();
  const exams = (await readExams())
    .filter((e) => new Date(`${e.date}T12:00:00`).getTime() > now)
    .slice(0, 10);
  for (const exam of exams) {
    const weekBefore = new Date(`${exam.date}T16:00:00`);
    weekBefore.setDate(weekBefore.getDate() - 7);
    if (weekBefore.getTime() > now) {
      await N.scheduleNotificationAsync({
        content: { title: `${exam.title} in one week 📚`, body: 'Time to start past papers — a paper a day wins.' },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: weekBefore, channelId: CHANNEL_ID },
      });
    }
    const dayBefore = new Date(`${exam.date}T07:00:00`);
    dayBefore.setDate(dayBefore.getDate() - 1);
    if (dayBefore.getTime() > now) {
      await N.scheduleNotificationAsync({
        content: { title: `Tomorrow: ${exam.title} 📝`, body: 'Light revision today, early night tonight. You’ve got this.' },
        trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: dayBefore, channelId: CHANNEL_ID },
      });
    }
  }
}

/**
 * Merge the exams the student can see (calendar loads month by month) into the
 * stored set, then reschedule everything if reminders are on. `removed` drops
 * an exam the student deleted.
 */
export async function syncExamReminders(exams: ExamEntry[], removed?: ExamEntry): Promise<void> {
  const existing = await readExams();
  const byKey = new Map(existing.map((e) => [`${e.title}|${e.date}`, e]));
  for (const e of exams) {
    byKey.set(`${e.title}|${e.date}`, { title: e.title, date: e.date });
  }
  if (removed) {
    byKey.delete(`${removed.title}|${removed.date}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const merged = [...byKey.values()].filter((e) => e.date >= today);
  await AsyncStorage.setItem(EXAMS_KEY, JSON.stringify(merged));

  if (await isReminderEnabled()) {
    // Quiet reschedule — no permission prompt, no confirmation toast.
    const N = await getNotifications();
    await rescheduleAll(N);
  }
}

/** Re-arm the reminder on app start if the student previously enabled it. */
export async function syncReminderOnLaunch(): Promise<void> {
  if (await isReminderEnabled()) {
    await setReminderEnabled(true);
  }
}
