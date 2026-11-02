import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text } from 'react-native';
import { Button, Card, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type School = { school_name: string; school_type: string; country: string; state: string | null; city: string | null; address: string | null; contact_phone: string | null; school_code: string; status: string };

export default function SchoolSettingsScreen() {
  const [school, setSchool] = useState<School | null>(null);
  const [form, setForm] = useState({ school_name: '', school_type: '', country: '', state: '', city: '', address: '', contact_phone: '' });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Sign in as a school administrator to view settings.');
      const result = await apiRequest<{ school: School }>('/api/schools/settings', { token: session.access_token });
      setSchool(result.school);
      setForm({ school_name: result.school.school_name, school_type: result.school.school_type, country: result.school.country, state: result.school.state || '', city: result.school.city || '', address: result.school.address || '', contact_phone: result.school.contact_phone || '' });
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to load school settings.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save() {
    setSaving(true); setMessage('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Your school administrator session has expired.');
      const result = await apiRequest<{ school: School }>('/api/schools/settings', { method: 'PATCH', token: session.access_token, body: JSON.stringify(form) });
      setSchool(result.school); setMessage('School details saved.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to save school settings.'); }
    finally { setSaving(false); }
  }
  return <Screen><Heading title="School settings" subtitle="Update the school information used by your existing school account." />{message ? <Notice message={message} success={message === 'School details saved.'} /> : null}{loading ? <ActivityIndicator color={colors.teal} /> : <>
    {school ? <Card style={styles.info}><Text style={styles.label}>School code · {school.school_code}</Text><Text style={uiStyles.smallMuted}>Account status · {school.status}</Text></Card> : null}
    <Field label="School or madrasa name" value={form.school_name} onChangeText={(v) => setForm({ ...form, school_name: v })} />
    <Field label="Institution type" value={form.school_type} onChangeText={(v) => setForm({ ...form, school_type: v })} />
    <Field label="Country" value={form.country} onChangeText={(v) => setForm({ ...form, country: v })} />
    <Field label="State" value={form.state} onChangeText={(v) => setForm({ ...form, state: v })} />
    <Field label="City" value={form.city} onChangeText={(v) => setForm({ ...form, city: v })} />
    <Field label="Address" value={form.address} onChangeText={(v) => setForm({ ...form, address: v })} multiline />
    <Field label="Contact phone" value={form.contact_phone} onChangeText={(v) => setForm({ ...form, contact_phone: v })} keyboardType="phone-pad" />
    <Button title={saving ? 'Saving…' : 'Save school details'} disabled={saving} onPress={() => void save()} />
  </>}</Screen>;
}

const styles = StyleSheet.create({ info: { backgroundColor: colors.mint }, label: { color: colors.tealDark, fontWeight: '900' } });
