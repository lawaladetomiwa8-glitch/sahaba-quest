import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Field, Heading, Notice, Screen } from '@/components/ui';
import { ApiError, apiRequest } from '@/lib/api';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { TurnstileChallenge } from '@/components/turnstile-challenge';

export default function SchoolAdminSignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaInstance, setCaptchaInstance] = useState(0);

  async function signIn() {
    setMessage('');
    if (!supabaseConfigured) { setMessage('Set the Supabase URL and publishable key in mobile/.env.'); return; }
    if (!email.trim() || !password) { setMessage('Enter your administrator email and password.'); return; }
    if (!captchaToken) { setMessage('Complete the security check before signing in.'); return; }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password, options: { captchaToken } });
    setCaptchaToken(null); setCaptchaInstance((value) => value + 1);
    if (error || !data.session) { setBusy(false); setMessage(error?.message || 'Unable to sign in.'); return; }
    try {
      await apiRequest('/api/schools/dashboard', { token: data.session.access_token });
      router.replace('/school-admin-home');
    } catch (apiError) {
      if (apiError instanceof ApiError && (apiError.status === 401 || apiError.status === 403)) await supabase.auth.signOut();
      setMessage(apiError instanceof Error ? apiError.message : 'This login does not have active school administrator access.');
    } finally { setBusy(false); }
  }

  return <Screen>
    <Heading title="School administrator login" subtitle="Sign in with the verified administrator account for your school or madrasa." />
    <Notice message={message} />
    <Field label="Administrator email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
    <TurnstileChallenge key={captchaInstance} onToken={setCaptchaToken} />
    <Button title="Sign in to school dashboard →" onPress={() => void signIn()} disabled={busy} />
    <Button title="Schools & Madrasas" secondary onPress={() => router.push('/schools')} />
  </Screen>;
}
