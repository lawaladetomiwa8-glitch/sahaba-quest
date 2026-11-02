import { router } from 'expo-router';
import { StyleSheet, Text } from 'react-native';

import { Button, Card, Heading, Screen, uiStyles } from '@/components/ui';
import { colors } from '@/lib/theme';

export default function SchoolsScreen() {
  return <Screen>
    <Heading title="Schools & Madrasas" subtitle="A dedicated learning and competition experience for schools, madrasas, and Islamic educational institutions." />
    <Card><Text style={styles.icon}>🎓</Text><Text style={styles.title}>Already a student?</Text><Text style={uiStyles.smallMuted}>Sign in with the Student ID and PIN provided by your school.</Text><Button title="Student login →" onPress={() => router.push('/student-sign-in')} /></Card>
    <Card><Text style={styles.icon}>🏫</Text><Text style={styles.title}>Already registered?</Text><Text style={uiStyles.smallMuted}>School and madrasa administrators sign in with their account email and password.</Text><Button title="Administrator sign in →" onPress={() => router.push('/school-admin-sign-in')} /></Card>
    <Card><Text style={styles.icon}>🔐</Text><Text style={styles.title}>New school or madrasa?</Text><Text style={uiStyles.smallMuted}>Register your institution, verify the administrator email, and choose a school plan.</Text><Button title="Register school →" secondary onPress={() => router.push('/schools/register')} /></Card>
  </Screen>;
}

const styles = StyleSheet.create({
  icon: { fontSize: 25 },
  title: { color: colors.ink, fontSize: 18, fontWeight: '900' },
});
