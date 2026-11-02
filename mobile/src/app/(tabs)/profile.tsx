import { useCallback, useEffect, useState } from 'react';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function ProfileTab() {
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null; account_type: string | null } | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setEmail(user.email || '');
    const { data, error } = await supabase.from('profiles').select('display_name, username, account_type').eq('id', user.id).maybeSingle();
    if (error) setMessage(error.message);
    setProfile(data);
    setDisplayName(data?.display_name || '');
    setUsername(data?.username || '');
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) setMessage(error.message);
  }
  async function saveProfile() {
    const cleanDisplayName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    if (!cleanDisplayName || !cleanUsername) { setMessage('Display name and username cannot be empty.'); return; }
    if (cleanUsername.length < 3 || !/^[a-z0-9_]+$/.test(cleanUsername)) { setMessage('Username must be at least 3 characters and use only lowercase letters, numbers, and underscores.'); return; }
    setSaving(true); setMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setMessage('You are not logged in.'); return; }
    const { error } = await supabase.from('profiles').update({ username: cleanUsername, display_name: cleanDisplayName }).eq('id', user.id);
    setSaving(false);
    if (error) { const lower = error.message.toLowerCase(); setMessage(lower.includes('profiles_username_unique') ? 'That username is already taken.' : lower.includes('profiles_display_name_unique') ? 'That display name is already in use.' : error.message); return; }
    setProfile((current) => current ? { ...current, display_name: cleanDisplayName, username: cleanUsername } : current);
    setMessage('Profile updated successfully.');
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;

  return <Screen>
    <Heading title="Your profile" subtitle="Your Sahaba Quest account details." />
    <Notice message={message} success={message === 'Profile updated successfully.'} />
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
    <Card><Text style={styles.rowTitle}>Edit profile</Text><Field label="Display name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" maxLength={40} /><Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={20} /><Button title={saving ? 'Saving…' : 'Save profile'} disabled={saving} onPress={() => void saveProfile()} /></Card>
    <Button title="Plans and subscription →" onPress={() => router.push('/pricing')} />
    <Button title="Sponsored competitions" secondary onPress={() => router.push('/sponsored')} />
    <Button title="Explore the Sahaba library" secondary onPress={() => router.push('/sahaba')} />
    <Button title="Reset password" secondary onPress={() => router.push('/forgot-password')} />
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
