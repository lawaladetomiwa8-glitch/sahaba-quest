import { router } from 'expo-router';

import { Button, Card, Heading, Screen } from '@/components/ui';

export default function FamilyAccessScreen() {
  return <Screen>
    <Heading title="Family Quest" subtitle="Choose how you want to enter your family's learning space." />
    <Card>
      <Heading title="Family owner" subtitle="Sign in with the email and password used to create your Family Account." />
      <Button title="Family owner sign in" onPress={() => router.push({ pathname: '/sign-in', params: { account: 'family' } })} />
    </Card>
    <Card>
      <Heading title="Family member" subtitle="The family owner must sign in first. Then select your profile and enter your 4-digit PIN." />
      <Button title="Choose a family member" secondary onPress={() => router.push('/family-member-sign-in')} />
    </Card>
  </Screen>;
}
