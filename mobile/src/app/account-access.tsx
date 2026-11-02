import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Button, Card, Heading, Screen, uiStyles } from '@/components/ui';
import { colors } from '@/lib/theme';

const choices = [
  { icon: '🎮', title: 'Individual account', description: 'Your personal Sahaba Quest account.', route: '/sign-in' as const },
  { icon: '👨‍👩‍👧‍👦', title: 'Family account', description: 'Sign in as the family owner or choose a family member.', route: '/family-access' as const },
  { icon: '🏫', title: 'School administrator', description: 'Manage your school or madrasa.', route: '/school-admin-sign-in' as const },
  { icon: '🎓', title: 'School student', description: 'Use the Student ID and PIN provided by your school.', route: '/student-sign-in' as const },
];

export default function AccountAccessScreen() {
  return <Screen>
    <Heading title="Choose your sign-in" subtitle="Select the account type provided for your Sahaba Quest journey." />
    {choices.map((choice) => <Card key={choice.title} style={styles.card}>
      <View style={styles.headingRow}>
        <Text style={styles.icon}>{choice.icon}</Text>
        <View style={styles.copy}>
          <Text style={styles.title}>{choice.title}</Text>
          <Text style={uiStyles.smallMuted}>{choice.description}</Text>
        </View>
      </View>
      <Button title={`Continue →`} onPress={() => router.push(choice.route)} />
    </Card>)}
    <Button title="Create an individual account" secondary onPress={() => router.push('/sign-up')} />
    <Button title="Register a school or madrasa" secondary onPress={() => router.push('/schools')} />
  </Screen>;
}

const styles = StyleSheet.create({
  card: { padding: 16 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  icon: { width: 44, height: 44, textAlign: 'center', textAlignVertical: 'center', fontSize: 24, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.mint },
  copy: { flex: 1, gap: 3 },
  title: { color: colors.ink, fontSize: 16, fontWeight: '800' },
});
