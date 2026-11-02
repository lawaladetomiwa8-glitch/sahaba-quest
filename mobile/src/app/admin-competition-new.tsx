import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, TextInput } from 'react-native';
import { Button, Card, Heading, Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const empty = { sponsor: '', title: '', sponsorDescription: '', description: '', rules: '', prizes: '', startsAt: '', endsAt: '', displayOrder: '0' };
export default function AdminCompetitionNewScreen() {
  const [form, setForm] = useState(empty);
  const [type, setType] = useState<'weekly' | 'monthly'>('monthly');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  function field(key: keyof typeof empty, value: string) { setForm((current) => ({ ...current, [key]: value })); }
  async function create() {
    setMessage('');
    if (!form.sponsor.trim() || !form.title.trim() || !form.startsAt || !form.endsAt) { setMessage('Sponsor, title, and both schedule dates are required.'); return; }
    const startsAt = new Date(form.startsAt); const endsAt = new Date(form.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) { setMessage('Enter valid dates; the end must be later than the start.'); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/sign-in'); return; }
      const { data: admin, error: adminError } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).eq('is_active', true).maybeSingle();
      if (!admin || adminError) { setMessage(adminError?.message || 'Active administrator access is required.'); return; }
      const { data, error } = await supabase.from('sponsored_competitions').insert({ sponsor_name: form.sponsor.trim(), sponsor_description: form.sponsorDescription.trim() || null, title: form.title.trim(), description: form.description.trim() || null, rules: form.rules.trim() || null, prizes: form.prizes.trim() || null, competition_type: type, starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), is_published: false, display_order: Number.parseInt(form.displayOrder, 10) || 0, created_by: admin.user_id }).select('id').single();
      if (error) setMessage(error.message); else router.replace('/admin-competition/' + data.id);
    } finally { setSaving(false); }
  }
  return <Screen><Button title="← Admin dashboard" secondary onPress={() => router.replace('/admin-competitions')} /><Heading title="Create competition" subtitle="New competitions start as drafts and can be published after review." /><Notice message={message} /><Card>
    {([['sponsor', 'Sponsor name'], ['title', 'Competition title'], ['sponsorDescription', 'Sponsor details'], ['description', 'Description'], ['rules', 'Rules'], ['prizes', 'Prizes'], ['startsAt', 'Start date and time (ISO or local date)'], ['endsAt', 'End date and time (ISO or local date)'], ['displayOrder', 'Display order']] as const).map(([key, label]) => <TextInput key={key} value={form[key]} onChangeText={(value) => field(key, value)} placeholder={label} placeholderTextColor={colors.muted} style={[styles.input, ['sponsorDescription', 'description', 'rules', 'prizes'].includes(key) && styles.multiline]} multiline={['sponsorDescription', 'description', 'rules', 'prizes'].includes(key)} />)}
    <Text style={styles.label}>Competition period</Text><Button title="Weekly" secondary={type !== 'weekly'} onPress={() => setType('weekly')} /><Button title="Monthly" secondary={type !== 'monthly'} onPress={() => setType('monthly')} /><Button title={saving ? 'Creating…' : 'Create draft'} disabled={saving} onPress={() => void create()} />
  </Card></Screen>;
}
const styles = StyleSheet.create({ input: { minHeight: 48, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', color: colors.ink, borderRadius: 12, paddingHorizontal: 14, marginBottom: 11 }, multiline: { minHeight: 90, textAlignVertical: 'top', paddingTop: 12 }, label: { fontWeight: '800', color: colors.ink, marginVertical: 8 } });
