import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';

import { Button, Field, Heading, Notice, Screen } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { clearFamilyMemberSession, saveStudentSession } from '@/lib/secure-sessions';
import { supabase } from '@/lib/supabase';

type LoginResponse = {
  success: boolean;
  message?: string;
  session: { token: string; expires_at: string };
};

export default function StudentSignInScreen() {
  const [studentId, setStudentId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function signIn() {
    setMessage('');
    const normalizedId = studentId.trim().toUpperCase();
    const cleanPin = pin.replace(/\D/g, '').slice(0, 6);
    if (!normalizedId || !/^\d{6}$/.test(cleanPin)) {
      setMessage('Enter your Student ID and the 6-digit PIN provided by your school.');
      return;
    }

    setBusy(true);
    try {
      const result = await apiRequest<LoginResponse>('/api/schools/student-auth/login', {
        method: 'POST',
        body: JSON.stringify({ student_id: normalizedId, pin: cleanPin }),
      });
      if (!result.success || !result.session?.token || !result.session?.expires_at) {
        throw new Error(result.message || 'The school could not start your student session.');
      }
      await Promise.all([supabase.auth.signOut(), clearFamilyMemberSession()]);
      await saveStudentSession({ token: result.session.token, expiresAt: result.session.expires_at });
      router.replace('/student-home');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <Screen>
    <Heading title="Student login" subtitle="Sign in with the Student ID and 6-digit PIN provided by your school or madrasa." />
    <Notice message={message} />
    <Field label="Student ID" value={studentId} onChangeText={setStudentId} autoCapitalize="characters" autoCorrect={false} />
    <Field label="6-digit PIN" value={pin} onChangeText={(value) => setPin(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} secureTextEntry />
    <Text style={styles.note}>Your student account is managed by your school. Ask your administrator if you need your PIN reset.</Text>
    <Button title={busy ? 'Signing in…' : 'Continue to Sahaba Quest →'} onPress={() => void signIn()} disabled={busy} />
    <Button title="Schools & Madrasas" secondary onPress={() => router.push('/schools')} />
  </Screen>;
}

const styles = StyleSheet.create({ note: { color: '#637A7F', fontSize: 13, lineHeight: 20 } });
