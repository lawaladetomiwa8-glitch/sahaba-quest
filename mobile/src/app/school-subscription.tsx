import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { Button, Card, Field, Heading, Notice, Screen, uiStyles, type NoticeType } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { colors } from '@/lib/theme';

type Pricing = { currency: 'NGN' | 'USD' | 'GBP' | 'EUR'; billing_interval: 'monthly' | 'termly'; price_per_student: number; display_name: string };
type Details = { school: { id: string; school_name: string }; subscription: { status: string; student_seat_limit: number; currency: string; billing_interval: string; total_amount: number; current_period_end: string } | null; pricing: Pricing[]; transactions: { transaction_reference: string; status: string; total_amount: number; currency: string; created_at: string }[] };

export default function SchoolSubscriptionScreen() {
  const { session, loading: authLoading } = useAuth();
  const [details, setDetails] = useState<Details | null>(null);
  const [seats, setSeats] = useState('10');
  const [selected, setSelected] = useState<Pricing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<NoticeType>('error');

  const load = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) { setLoading(false); return; }
    try {
      const payload = await apiRequest<Details>('/api/schools/subscription', { token });
      setDetails(payload);
      setSeats(String(payload.subscription?.student_seat_limit || 10));
      setSelected(payload.pricing[0] || null);
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Could not load school plans.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { if (!authLoading && session) void load(); else if (!authLoading) setLoading(false); }, [authLoading, session, load]);

  async function startCheckout() {
    const count = Number(seats);
    if (!selected || !Number.isInteger(count) || count < 1) { setMessage('Enter a valid number of student seats and select a plan.'); return; }
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token || !details) { setMessage('Sign in again to manage your school subscription.'); return; }
    setBusy(true); setMessage(''); setMessageType('error');
    try {
      const checkout = await apiRequest<{ checkout_url: string }>('/api/schools/payment/initialize', {
        method: 'POST', token,
        body: JSON.stringify({ school_id: details.school.id, student_seat_limit: count, billing_interval: selected.billing_interval, currency: selected.currency }),
      });
      if (!checkout.checkout_url) throw new Error('The payment service did not return a checkout page.');
      await WebBrowser.openBrowserAsync(checkout.checkout_url);
      setMessageType('info');
      setMessage('When you return from checkout, refresh to confirm the verified subscription status. Payment verification stays on the Sahaba Quest server.');
      setLoading(true);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to start checkout.'); }
    finally { setBusy(false); }
  }

  if (authLoading || loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!session) return <Redirect href="/school-admin-sign-in" />;
  const activePrice = selected ? details?.pricing.find((item) => item.currency === selected.currency && item.billing_interval === selected.billing_interval) : null;
  const total = activePrice ? activePrice.price_per_student * Number(seats || 0) : 0;
  return <Screen>
    <Button title="← School dashboard" secondary onPress={() => router.replace('/school-admin-home')} />
    <Heading title="School subscription" subtitle={details?.school.school_name || 'Manage student seats and billing.'} />
    <Notice message={message} type={messageType} />
    {details ? <>
      <Card><Text style={styles.title}>Current plan</Text>{details.subscription ? <><Text style={styles.plan}>{details.subscription.status} · {details.subscription.billing_interval}</Text><Text style={uiStyles.smallMuted}>{details.subscription.student_seat_limit} student seats · {details.subscription.currency} {details.subscription.total_amount}</Text></> : <Text style={uiStyles.smallMuted}>No subscription is active yet.</Text>}</Card>
      <Card><Text style={styles.title}>Choose a plan</Text>
        <Field label="Student seats" value={seats} onChangeText={(value) => setSeats(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
        <Text style={styles.label}>Available billing plans</Text>
        {details.pricing.map((item) => {
          const active = item.currency === selected?.currency && item.billing_interval === selected?.billing_interval;
          return <Pressable key={`${item.currency}-${item.billing_interval}`} onPress={() => setSelected(item)} style={[styles.choice, active && styles.activeChoice]}>
            <Text style={[styles.plan, active && styles.activeText]}>{item.display_name}</Text>
            <Text style={uiStyles.smallMuted}>{item.currency} {item.price_per_student} per student · {item.billing_interval}</Text>
          </Pressable>;
        })}
        {selected ? <Text style={styles.total}>Estimated total: {selected.currency} {Number.isFinite(total) ? total.toLocaleString() : '—'}</Text> : null}
        <Button title={busy ? 'Opening secure checkout…' : 'Continue to payment →'} onPress={() => void startCheckout()} disabled={busy || !selected} />
      </Card>
      {details.transactions.length ? <Card><Text style={styles.title}>Recent payments</Text>{details.transactions.slice(0, 10).map((transaction) => <View key={transaction.transaction_reference} style={styles.transaction}><Text style={styles.plan}>{transaction.status}</Text><Text style={uiStyles.smallMuted}>{transaction.currency} {transaction.total_amount} · {new Date(transaction.created_at).toLocaleDateString()}</Text></View>)}</Card> : null}
      <Button title="Refresh plan details" secondary onPress={() => { setLoading(true); void load(); }} />
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  title: { color: colors.ink, fontSize: 19, fontWeight: '900' },
  plan: { color: colors.tealDark, fontSize: 15, fontWeight: '900', textTransform: 'capitalize' },
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  choice: { padding: 13, gap: 4, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: '#fff' },
  activeChoice: { borderColor: colors.teal, backgroundColor: colors.mint },
  activeText: { color: colors.teal },
  total: { color: colors.ink, fontSize: 17, fontWeight: '900' },
  transaction: { paddingVertical: 8, gap: 4, borderTopWidth: 1, borderTopColor: colors.border },
});
