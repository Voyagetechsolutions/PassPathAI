import { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useAuth } from '../src/lib/auth';
import { apiRequest } from '../src/lib/api';
import { useApi } from '../src/lib/use-api';
import { Screen } from '../src/components/screen';
import { Card, ErrorText, Loading } from '../src/components/ui';
import { Bulb, Timer, Target, Check, GradCap } from '../src/components/icons';
import { colors, radius, spacing, text } from '../src/theme';
import type { SubscriptionStatus } from '../src/lib/types';

const CALLBACK_URL = 'passpath://payment-callback';

/**
 * Google Play policy: digital subscriptions sold inside an Android app must use
 * Play Billing. Ours is sold on the website (Paystack), so the Android build
 * shows no purchase flow — Premium simply unlocks once the account is upgraded.
 */
const CAN_PURCHASE_IN_APP = Platform.OS !== 'android';

const FEATURES = [
  { icon: Bulb, title: 'Unlimited AI tutor chat', body: 'Real back-and-forth conversations that teach every topic — no message limits.' },
  { icon: Timer, title: 'Unlimited mock exams', body: 'AI-marked timed papers for every subject, whenever you want to test yourself.' },
  { icon: Target, title: 'Adaptive practice, fully unlocked', body: 'Questions that meet you at your level, with AI explanations when you get one wrong.' },
  { icon: GradCap, title: 'Full career guidance', body: 'The What-If simulator, every recommended career, and every university match.' },
];

export default function PremiumScreen() {
  const router = useRouter();
  const { token } = useAuth();
  const { data: status, loading, error, reload } = useApi<SubscriptionStatus>('/subscription/me');
  const [busy, setBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);

  const subscribe = useCallback(async () => {
    setBusy(true);
    setCheckoutError(null);
    try {
      const { authorizationUrl } = await apiRequest<{ authorizationUrl: string }>('/subscription/checkout', {
        method: 'POST',
        token,
        body: { callbackUrl: CALLBACK_URL },
      });
      const result = await WebBrowser.openAuthSessionAsync(authorizationUrl, CALLBACK_URL);
      if (result.type === 'success') {
        // Paystack's webhook is the source of truth and may land a beat after the
        // redirect — brief pause, then reload so the UI catches up.
        await new Promise((r) => setTimeout(r, 1500));
        await reload();
      }
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Could not start checkout — try again.');
    } finally {
      setBusy(false);
    }
  }, [token, reload]);

  const cancel = useCallback(async () => {
    setBusy(true);
    setCheckoutError(null);
    try {
      await apiRequest('/subscription/cancel', { method: 'POST', token });
      await reload();
    } catch (e) {
      setCheckoutError(e instanceof Error ? e.message : 'Could not cancel — try again.');
    } finally {
      setBusy(false);
    }
  }, [token, reload]);

  if (loading) return <Screen onBack={() => router.back()}><Loading label="Loading Premium…" /></Screen>;

  return (
    <Screen title="PassPath Premium" subtitle="Everything you need to actually pass." onBack={() => router.back()}>
      {error ? <ErrorText message={error} /> : null}

      {status?.isPremium ? (
        <Card style={{ backgroundColor: colors.navy, alignItems: 'center' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Check color={colors.white} size={28} />
          </View>
          <Text style={{ color: colors.white, fontSize: 20, fontFamily: 'Poppins_700Bold' }}>You’re Premium</Text>
          {status.currentPeriodEnd ? (
            <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>
              {status.cancelAtPeriodEnd ? 'Cancels' : 'Renews'} on {new Date(status.currentPeriodEnd).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}
            </Text>
          ) : null}
        </Card>
      ) : (
        <Card style={{ alignItems: 'center', backgroundColor: colors.brand }}>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontFamily: 'Poppins_600SemiBold' }}>PREMIUM</Text>
          <Text style={{ color: colors.white, fontSize: 40, fontFamily: 'Poppins_700Bold', marginTop: 4 }}>{status?.priceLabel ?? 'R200/month'}</Text>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 }}>Cancel any time</Text>
        </Card>
      )}

      <View style={{ gap: spacing.md }}>
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Card key={f.title} style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
              <View style={{ width: 40, height: 40, borderRadius: radius.sm, backgroundColor: colors.brand50, alignItems: 'center', justifyContent: 'center' }}>
                <Icon color={colors.brand} size={20} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold' }]}>{f.title}</Text>
                <Text style={[text.caption, { marginTop: 2 }]}>{f.body}</Text>
              </View>
            </Card>
          );
        })}
      </View>

      {checkoutError ? <ErrorText message={checkoutError} /> : null}

      {status?.isPremium ? (
        !status.cancelAtPeriodEnd ? (
          <Pressable onPress={cancel} disabled={busy} style={({ pressed }) => [{ alignItems: 'center', paddingVertical: spacing.md }, (pressed || busy) && { opacity: 0.6 }]}>
            <Text style={{ color: colors.danger, fontSize: 14, fontFamily: 'Poppins_600SemiBold' }}>{busy ? 'Cancelling…' : 'Cancel subscription'}</Text>
          </Pressable>
        ) : (
          <Text style={[text.caption, { textAlign: 'center' }]}>Your subscription is set to cancel — you’ll keep Premium until the date above.</Text>
        )
      ) : CAN_PURCHASE_IN_APP ? (
        <Pressable
          onPress={subscribe}
          disabled={busy}
          style={({ pressed }) => [{ backgroundColor: colors.brand, borderRadius: radius.md, paddingVertical: 16, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: spacing.sm }, (pressed || busy) && { opacity: 0.85 }]}
        >
          {busy ? <ActivityIndicator color={colors.white} /> : null}
          <Text style={{ color: colors.white, fontSize: 16, fontFamily: 'Poppins_700Bold' }}>{busy ? 'Opening secure checkout…' : `Subscribe — ${status?.priceLabel ?? 'R200/month'}`}</Text>
        </Pressable>
      ) : (
        <Card>
          <Text style={[text.body, { color: colors.ink, fontFamily: 'Poppins_600SemiBold', textAlign: 'center' }]}>
            Premium can’t be purchased inside the app.
          </Text>
          <Text style={[text.caption, { textAlign: 'center', marginTop: 6 }]}>
            Once your account is upgraded, Premium unlocks here automatically.
          </Text>
        </Card>
      )}
      {CAN_PURCHASE_IN_APP || status?.isPremium ? (
        <Text style={[text.caption, { textAlign: 'center' }]}>Secure checkout via Paystack. Cancel any time — no lock-in.</Text>
      ) : null}
    </Screen>
  );
}
