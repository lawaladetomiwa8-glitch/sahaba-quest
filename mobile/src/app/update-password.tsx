import { useState } from 'react';
import { router } from 'expo-router';

import { Button, Field, Heading, Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';

export default function UpdatePasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    setMessage('');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setMessage('Use at least 8 characters, including uppercase and lowercase letters, a number, and a special character.');
      return;
    }
    if (password !== confirm) { setMessage('The passwords do not match.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage('Your password has been updated. Sign in with your new password.');
    await supabase.auth.signOut();
    router.replace('/sign-in');
  }

  return <Screen>
    <Heading title="Choose a new password" subtitle="Use a strong password you have not used before." />
    <Notice message={message} success={message.startsWith('Your password')} />
    <Field label="New password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
    <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" />
    <Button title={busy ? 'Updating…' : 'Update password'} onPress={() => void save()} disabled={busy} />
  </Screen>;
}
