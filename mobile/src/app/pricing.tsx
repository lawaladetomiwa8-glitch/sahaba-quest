import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { Button, Card, Heading, Notice, Screen, uiStyles, type NoticeType } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import { SymbolView } from 'expo-symbols';

type Plan = { id: string; plan_type: 'plus' | 'family'; billing_interval: 'monthly' | 'annual'; currency: 'NGN' | 'USD' | 'GBP' | 'EUR'; amount: number; display_name: string };
type AccountType = 'free' | 'individual' | 'family';
type ActiveSubscription = { status: string; current_period_end: string | null; subscription_plans: { plan_type: string; display_name: string } | { plan_type: string; display_name: string }[] | null };

const currencies: Plan['currency'][] = ['NGN', 'USD', 'GBP', 'EUR'];
const planInfo = {
  plus: {
    description: 'The full personal Sahaba Quest experience for learners who want deeper access, more challenges and exclusive competitions.',
    features: ['Access to all Levels 1–10', 'Full Individual Quest journey', 'All Individual challenges and quizzes', 'Individual XP, streak and progress tracking', 'Individual leaderboard', 'Detailed performance statistics', 'Access to exclusive Individual competitions', 'Eligibility for sponsored competitions when active'],
  },
  family: {
    description: 'A dedicated Family Quest experience focused on the Sahabah, family life, parenting, character and learning together.',
    features: ['Access to all Levels 1–10', 'Full Family Quest journey', 'Family challenges and quizzes', 'Family XP and progress tracking', 'Separate Family leaderboard', 'Family-focused learning categories', 'Lessons and guidance for family life'],
  },
};

export default function PricingScreen() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currency, setCurrency] = useState<Plan['currency']>('NGN');
  const [interval, setInterval] = useState<Plan['billing_interval']>('monthly');
  const [accountType, setAccountType] = useState<AccountType>('free');
  const [subscription, setSubscription] = useState<ActiveSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState('');
  const [noticeType, setNoticeType] = useState<NoticeType>('info');

  const load = useCallback(async () => {
    setLoading(true);
    setNotice('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setNotice('Sign in to view account-specific upgrade options.'); setLoading(false); return; }
    const [{ data: profile, error: profileError }, { data: available, error }, { data: activeSubscription }] = await Promise.all([
      supabase.from('profiles').select('account_type').eq('id', user.id).maybeSingle(),
      supabase.from('subscription_plans').select('id,plan_type,billing_interval,currency,amount,display_name').in('plan_type', ['plus', 'family']).eq('billing_interval', interval).eq('currency', currency).eq('is_active', true).order('amount', { ascending: true }),
      supabase.from('subscriptions').select('status,current_period_end,subscription_plans(plan_type,display_name)').eq('user_id', user.id).eq('status', 'active').order('current_period_end', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (profileError || error) { setNoticeType('error'); setNotice(profileError?.message || error?.message || 'Could not load plans.'); }
    setAccountType(profile?.account_type === 'individual' || profile?.account_type === 'family' ? profile.account_type : 'free');
    setSubscription(activeSubscription as ActiveSubscription | null);
    setPlans((available || []) as Plan[]);
    setLoading(false);
  }, [currency, interval]);

  useEffect(() => { void load(); }, [load]);

  async function subscribe(plan: Plan) {
    setBusy(plan.plan_type);
    setNotice('');
    setNoticeType('info');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in before upgrading your account.');
      const initialized = await apiRequest<{ checkout_url: string }>('/api/payments/flutterwave/initialize', {
        method: 'POST', token: session.access_token,
        body: JSON.stringify({ plan_type: plan.plan_type, billing_interval: plan.billing_interval, currency: plan.currency }),
      });
      const result = await WebBrowser.openBrowserAsync(initialized.checkout_url);
      if (result.type === 'cancel' || result.type === 'dismiss') setNotice('Checkout closed. Your subscription only changes after the server verifies payment.');
      else setNotice('Checkout was opened securely. After payment, return here and refresh your account status. Access changes only after server verification.');
    } catch (error) { setNoticeType('error'); setNotice(error instanceof Error ? error.message : 'Unable to start secure checkout.'); }
    finally { setBusy(''); }
  }

  const money = (plan: Plan) => new Intl.NumberFormat('en-US', { style: 'currency', currency: plan.currency, minimumFractionDigits: plan.currency === 'NGN' ? 0 : 2, maximumFractionDigits: plan.currency === 'NGN' ? 0 : 2 }).format(plan.currency === 'NGN' ? plan.amount : plan.amount / 100);

  return <Screen>
    <Heading title="Sahaba Quest plans" subtitle="Choose a plan available to your account. Prices and eligibility come from the live subscription catalogue." />
    <Notice message={notice} type={noticeType} />
    <Card><Text style={styles.current}>Current account · {accountType}</Text>{subscription ? <Text style={uiStyles.smallMuted}>{(Array.isArray(subscription.subscription_plans) ? subscription.subscription_plans[0] : subscription.subscription_plans)?.display_name || 'Active subscription'}{subscription.current_period_end ? ` · active until ${new Date(subscription.current_period_end).toLocaleDateString()}` : ''}</Text> : <Text style={uiStyles.smallMuted}>No active paid subscription is recorded for this account.</Text>}<Text style={uiStyles.smallMuted}>Subscription access is updated only after payment is verified by Sahaba Quest.</Text></Card>
    <Card>
      <Text style={styles.label}>Billing</Text>
      <View style={styles.controls}>{(['monthly', 'annual'] as const).map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: interval === item }} onPress={() => setInterval(item)} style={[styles.selector, interval === item && styles.selectorSelected]}><SymbolView name={{ ios: interval === item ? 'checkmark.circle.fill' : 'circle', android: interval === item ? 'check_circle' : 'radio_button_unchecked' }} size={18} tintColor={interval === item ? '#fff' : colors.muted} /><Text style={[styles.selectorText, interval === item && styles.selectorTextSelected]}>{item === 'monthly' ? 'Monthly' : 'Annual'}</Text></Pressable>)}</View>
      <Text style={styles.label}>Currency</Text>
      <View style={styles.controls}>{currencies.map((item) => <Pressable key={item} accessibilityRole="radio" accessibilityState={{ checked: currency === item }} onPress={() => setCurrency(item)} style={[styles.currencySelector, currency === item && styles.selectorSelected]}><Text style={[styles.selectorText, currency === item && styles.selectorTextSelected]}>{item}</Text></Pressable>)}</View>
    </Card>
    {loading ? <ActivityIndicator color={colors.teal} /> : plans.length === 0 ? <Card><Text style={uiStyles.smallMuted}>No plans are listed for this currency and billing period.</Text></Card> : plans.map((plan) => {
      const current = (accountType === 'individual' && plan.plan_type === 'plus') || (accountType === 'family' && plan.plan_type === 'family');
      const blocked = accountType === 'family' && plan.plan_type === 'plus';
      return <Card key={plan.id} style={[styles.planCard, current && styles.active]}>
        <View style={styles.planHeader}><Text style={styles.badge}>{plan.plan_type === 'plus' ? 'INDIVIDUAL' : 'FAMILY'}</Text>{current ? <Text style={styles.currentBadge}>CURRENT PLAN</Text> : null}</View>
        <Text style={styles.name}>{plan.display_name}</Text>
        <View style={styles.priceRow}><Text style={styles.price}>{money(plan)}</Text><Text style={styles.pricePeriod}>/ {interval === 'annual' ? 'year' : 'month'}</Text></View>
        <Text style={styles.copy}>{planInfo[plan.plan_type].description}</Text>
        <View style={styles.benefits}>{planInfo[plan.plan_type].features.map((feature) => <View key={feature} style={styles.benefit}><SymbolView name={{ ios: 'checkmark.circle.fill', android: 'check_circle' }} size={17} tintColor={colors.teal} /><Text style={styles.benefitText}>{feature}</Text></View>)}</View>
        <Button title={current ? 'Current account' : blocked ? 'Not available for family accounts' : busy === plan.plan_type ? 'Opening secure checkout…' : `Continue with ${plan.display_name}`} disabled={current || blocked || !!busy} onPress={() => void subscribe(plan)} />
      </Card>;
    })}
    <Button title="Refresh plans and account" secondary onPress={() => void load()} />
  </Screen>;
}

const styles = StyleSheet.create({ controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, label: { color: colors.ink, fontWeight: '800', marginBottom: 8 }, current: { color: colors.ink, fontWeight: '900', textTransform: 'capitalize' }, active: { borderColor: colors.teal, borderWidth: 2, backgroundColor: '#F5FCFA' }, planCard: { padding: 20 }, planHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, badge: { color: colors.teal, backgroundColor: colors.mint, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, fontSize: 11, fontWeight: '900', letterSpacing: 1 }, currentBadge: { color: colors.tealDark, fontSize: 10, fontWeight: '900' }, name: { color: colors.ink, fontSize: 22, fontWeight: '900' }, priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 }, price: { color: colors.ink, fontSize: 32, fontWeight: '900' }, pricePeriod: { color: colors.muted, fontSize: 14 }, copy: { color: colors.muted, lineHeight: 21 }, benefits: { gap: 11, paddingVertical: 6 }, benefit: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 }, benefitText: { flex: 1, color: colors.ink, fontSize: 14, lineHeight: 20 }, selector: { minHeight: 46, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.border }, currencySelector: { minHeight: 44, minWidth: 62, paddingHorizontal: 14, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.mint, borderWidth: 1, borderColor: colors.border }, selectorSelected: { backgroundColor: colors.teal, borderColor: colors.teal }, selectorText: { color: colors.tealDark, fontWeight: '800' }, selectorTextSelected: { color: '#fff' } });
