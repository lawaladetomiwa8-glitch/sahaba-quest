import { Link, Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';

import { TurnstileChallenge } from '@/components/turnstile-challenge';
import { Button, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { useAuth } from '@/lib/auth-context';
import { supabase, supabaseConfigured } from '@/lib/supabase';

export default function SignUpScreen() {
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaInstance, setCaptchaInstance] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  if (session) return <Redirect href="/(tabs)" />;

  async function signUp() {
    setMessage('');
    setSuccess(false);
    if (!supabaseConfigured) return setMessage('Configure the Supabase URL and publishable key in mobile/.env first.');
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanName || !cleanUsername || !cleanEmail || !password || !confirmPassword) return setMessage('Complete all fields to create your account.');
    if (!/^[a-z0-9_]{3,20}$/.test(cleanUsername)) return setMessage('Username must be 3–20 characters using letters, numbers, or underscores.');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) return setMessage('Password needs 8 characters, an uppercase and lowercase letter, a number, and a special character.');
    if (password !== confirmPassword) return setMessage('Your passwords do not match.');
    if (!captchaToken) return setMessage('Complete the security check before creating your account.');

    setBusy(true);
    const { data: nameCheck, error: nameError } = await supabase.rpc('check_signup_names', {
      requested_username: cleanUsername,
      requested_display_name: cleanName,
    });
    if (nameError) {
      setBusy(false);
      return setMessage('Unable to check username availability. Please try again.');
    }
    const availability = Array.isArray(nameCheck) ? nameCheck[0] : nameCheck;
    if (availability?.username_available === false || availability?.username_exists === true) {
      setBusy(false);
      return setMessage('That username is already taken.');
    }
    if (availability?.display_name_available === false || availability?.display_name_exists === true) {
      setBusy(false);
      return setMessage('That display name is already taken.');
    }

    const { error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        captchaToken,
        data: { display_name: cleanName, username: cleanUsername, account_type: 'free' },
      },
    });
    setBusy(false);
    setCaptchaToken(null);
    setCaptchaInstance((current) => current + 1);
    if (error) setMessage(error.message);
    else setSuccess(true);
  }

  return <Screen>
    <Heading title={success ? 'Check your email' : 'Create your account'} subtitle={success ? 'We sent you a confirmation link. Open it to activate your Sahaba Quest account.' : 'Start your learning journey with a free account.'} />
    {success ? <>
      <Notice message="Confirmation email sent. You can sign in after confirming your email address." success />
      <Button title="Back to sign in" onPress={() => router.replace('/sign-in')} />
    </> : <>
      <Notice message={message} />
      <Field label="Display name" value={displayName} onChangeText={setDisplayName} autoCapitalize="words" maxLength={40} />
      <Field label="Username" value={username} onChangeText={setUsername} autoCapitalize="none" maxLength={20} />
      <Field label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
      <Field label="Password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
      <Field label="Confirm password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
      <View><Text style={uiStyles.smallMuted}>Password needs at least 8 characters, uppercase and lowercase letters, a number, and a special character.</Text></View>
      <TurnstileChallenge key={captchaInstance} onToken={setCaptchaToken} />
      <Button title="Create free account" onPress={signUp} disabled={busy} />
      <View style={uiStyles.row}><Text style={uiStyles.smallMuted}>Already have an account?</Text><Link href="/sign-in" style={{ color: '#087D73', fontWeight: '800' }}>Sign in</Link></View>
    </>}
  </Screen>;
}
