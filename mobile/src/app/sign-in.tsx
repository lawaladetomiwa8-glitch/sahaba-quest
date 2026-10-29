import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { TurnstileChallenge } from '@/components/turnstile-challenge';
import { Button, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export default function SignInScreen() {
  const { session } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaInstance, setCaptchaInstance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (session) return <Redirect href="/(tabs)" />;

  async function signIn() {
    setMessage('');
    if (!supabaseConfigured) return setMessage('Configure the Supabase URL and publishable key in mobile/.env first.');
    if (!captchaToken) return setMessage('Complete the security check before signing in.');
    if (!email.trim() || !password) return setMessage('Enter your email address and password.');
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(), password,
      options: { captchaToken },
    });
    setBusy(false);
    setCaptchaToken(null);
    setCaptchaInstance((current) => current + 1);
    if (error) setMessage(error.message);
    else router.replace('/(tabs)');
  }

  return <Screen>
    <Heading title="Welcome back" subtitle="Sign in to continue your Sahaba Quest journey." />
    <Notice message={message} />
    <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="password" />
    <TurnstileChallenge key={captchaInstance} onToken={setCaptchaToken} />
    <Button title="Sign in" onPress={signIn} disabled={busy} />
    <View style={uiStyles.row}><Text style={uiStyles.smallMuted}>New to Sahaba Quest?</Text><Link href="/sign-up" style={{ color: '#087D73', fontWeight: '800' }}>Create account</Link></View>
  </Screen>;
}
