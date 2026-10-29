import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function ProfileTab() {
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; account_type: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setEmail(user.email || '');
    const { data, error } = await supabase.from('profiles').select('display_name, username, account_type').eq('id', user.id).maybeSingle();
    if (error) setMessage(error.message);
    setProfile(data);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;

  return <Screen>
    <Heading title="Your profile" subtitle="Your Sahaba Quest account details." />
    <Notice message={message} />
    <Card style={styles.profileCard}>
      <View style={styles.avatar}><Text style={styles.initial}>{(profile?.display_name || profile?.username || email || 'P').slice(0, 1).toUpperCase()}</Text></View>
      <Text style={styles.name}>{profile?.display_name || profile?.username || 'Player'}</Text>
      <Text style={uiStyles.smallMuted}>{email}</Text>
    </Card>
    <Card>
      <Text style={styles.rowTitle}>Username</Text><Text style={uiStyles.smallMuted}>{profile?.username || 'Not set'}</Text>
      <View style={styles.divider} />
      <Text style={styles.rowTitle}>Account</Text><Text style={uiStyles.smallMuted}>{profile?.account_type || 'Free'}</Text>
    </Card>
    <Button title="Sign out" secondary onPress={signOut} />
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  profileCard: { alignItems: 'center', paddingVertical: 25 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  initial: { color: colors.teal, fontSize: 28, fontWeight: '900' },
  name: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  rowTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 4 },
});
