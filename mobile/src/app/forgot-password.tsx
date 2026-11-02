import { useState } from 'react';
import { router } from 'expo-router';
import { TurnstileChallenge } from '@/components/turnstile-challenge';
import { Button, Field, Heading, Notice, Screen } from '@/components/ui';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  async function send() {
    setMessage('');
    if (!supabaseConfigured) { setMessage('Configure Supabase before requesting a password reset.'); return; }
    if (!email.trim()) { setMessage('Enter your account email address.'); return; }
    if (!captchaToken) { setMessage('Complete the security check before requesting a password reset.'); return; }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
      redirectTo: 'sahabaquest://auth/callback',
      captchaToken,
    });
    setBusy(false);
    setCaptchaToken(null);
    setMessage(error?.message || 'If an account exists for this email, password reset instructions have been sent. Continue using the secure link in your email.');
  }
  return <Screen><Heading title="Reset your password" subtitle="We’ll send a secure reset link to your Sahaba Quest email address." /><Notice message={message} /><Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" /><TurnstileChallenge key={message} onToken={setCaptchaToken} /><Button title={busy ? 'Sending…' : 'Send reset instructions'} disabled={busy} onPress={() => void send()} /><Button title="Back to sign in" secondary onPress={() => router.replace('/sign-in')} /></Screen>;
}
