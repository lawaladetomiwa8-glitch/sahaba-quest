import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Button, Field, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { apiRequest } from '@/lib/api';
import { colors } from '@/lib/theme';

type SchoolType = 'school' | 'madrasa' | 'islamic_centre' | 'other';

export default function SchoolRegistrationScreen() {
  const [schoolName, setSchoolName] = useState('');
  const [schoolType, setSchoolType] = useState<SchoolType>('school');
  const [country, setCountry] = useState('NG');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [adminName, setAdminName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [registeredEmail, setRegisteredEmail] = useState('');

  async function register() {
    setMessage('');
    if (!schoolName.trim() || !state.trim() || !city.trim() || !phone.trim() || !adminName.trim() || !email.trim() || !password || !confirmPassword) {
      setMessage('Complete all required school and administrator fields.'); return;
    }
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
      setMessage('Password needs 8 characters, uppercase and lowercase letters, a number, and a special character.'); return;
    }
    if (password !== confirmPassword) { setMessage('The passwords do not match.'); return; }
    setBusy(true);
    try {
      const response = await apiRequest<{ success: boolean; error?: string; school?: { id: string }; message?: string }>('/api/schools/register', {
        method: 'POST',
        body: JSON.stringify({
          school_name: schoolName.trim(), school_type: schoolType, country: country.trim().toUpperCase(), state: state.trim(), city: city.trim(),
          address: address.trim(), contact_phone: phone.trim(), admin_full_name: adminName.trim(),
          admin_email: email.trim().toLowerCase(), admin_password: password,
        }),
      });
      if (!response.success || !response.school?.id) throw new Error(response.error || response.message || 'Unable to create the school account.');
      setRegisteredEmail(email.trim().toLowerCase());
      setPassword(''); setConfirmPassword('');
      setMessage('Registration created. Confirm the administrator email using the link we sent. The existing confirmation link opens Sahaba Quest in your browser; then return here and sign in to continue setup.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Unable to complete registration.'); }
    finally { setBusy(false); }
  }

  if (registeredEmail) return <Screen>
    <Heading title="Check your email" subtitle={`We sent a verification link to ${registeredEmail}.`} />
    <Notice message={message} success />
    <Text style={uiStyles.smallMuted}>The email confirmation uses the current Sahaba Quest website callback. After confirming your email, return to the app and sign in as the school administrator.</Text>
    <Button title="School administrator sign in →" onPress={() => router.replace('/school-admin-sign-in')} />
    <Button title="Schools & Madrasas" secondary onPress={() => router.replace('/schools')} />
  </Screen>;

  return <Screen>
    <Button title="← Schools & Madrasas" secondary onPress={() => router.back()} />
    <Heading title="Register your school" subtitle="Create the administrator account and institution record using Sahaba Quest's existing school registration service." />
    <Notice message={message} />
    <Field label="School / Madrasa name *" value={schoolName} onChangeText={setSchoolName} />
    <Text style={styles.label}>Institution type</Text>
    <Text style={uiStyles.smallMuted}>Choose one</Text>
    {([['school', 'School'], ['madrasa', 'Madrasa'], ['islamic_centre', 'Islamic Centre'], ['other', 'Other']] as [SchoolType, string][]).map(([value, label]) => <Pressable key={value} onPress={() => setSchoolType(value)} style={[styles.choice, schoolType === value && styles.choiceActive]}><Text style={[styles.choiceText, schoolType === value && styles.choiceTextActive]}>{label}</Text></Pressable>)}
    <Field label="Country code (2 letters, e.g. NG) *" value={country} onChangeText={(value) => setCountry(value.replace(/[^a-z]/gi, '').slice(0, 2).toUpperCase())} autoCapitalize="characters" maxLength={2} />
    <Field label="State *" value={state} onChangeText={setState} />
    <Field label="City *" value={city} onChangeText={setCity} />
    <Field label="Contact phone *" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
    <Field label="School address" value={address} onChangeText={setAddress} />
    <Text style={styles.section}>Administrator</Text>
    <Field label="Full name *" value={adminName} onChangeText={setAdminName} autoCapitalize="words" />
    <Field label="Email *" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
    <Field label="Password *" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" />
    <Field label="Confirm password *" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry autoCapitalize="none" />
    <Button title={busy ? 'Creating account…' : 'Create school account'} onPress={() => void register()} disabled={busy} />
  </Screen>;
}

const styles = StyleSheet.create({
  label: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  choice: { minHeight: 43, justifyContent: 'center', paddingHorizontal: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff' },
  choiceActive: { borderColor: colors.teal, backgroundColor: colors.mint },
  choiceText: { color: colors.ink, fontWeight: '700' },
  choiceTextActive: { color: colors.tealDark },
  section: { color: colors.tealDark, fontSize: 18, fontWeight: '900', marginTop: 6 },
});
