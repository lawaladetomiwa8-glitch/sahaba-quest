import { useEffect, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import * as Linking from 'expo-linking';
import { ActivityIndicator, Text } from 'react-native';

import { Notice, Screen } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

function parseAuthUrl(rawUrl: string) {
  const query = new URL(rawUrl).searchParams;
  const hash = new URLSearchParams(new URL(rawUrl).hash.replace(/^#/, ''));
  return {
    code: query.get('code'),
    accessToken: hash.get('access_token') || query.get('access_token'),
    refreshToken: hash.get('refresh_token') || query.get('refresh_token'),
    type: query.get('type') || hash.get('type'),
    error: query.get('error_description') || hash.get('error_description'),
  };
}

export default function AuthCallbackScreen() {
  const params = useLocalSearchParams<{ code?: string; type?: string; error_description?: string }>();
  const [message, setMessage] = useState('Completing your secure sign-in…');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    async function finish(rawUrl?: string | null) {
      if (!rawUrl) return;
      try {
        const auth = parseAuthUrl(rawUrl);
        if (auth.error) throw new Error(decodeURIComponent(auth.error));
        if (auth.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(auth.code);
          if (error) throw error;
        } else if (auth.accessToken && auth.refreshToken) {
          const { error } = await supabase.auth.setSession({ access_token: auth.accessToken, refresh_token: auth.refreshToken });
          if (error) throw error;
        } else {
          throw new Error('This link is incomplete or has expired. Request a new email link and try again.');
        }
        if (!active) return;
        if (auth.type === 'recovery' || params.type === 'recovery') router.replace('/update-password');
        else router.replace('/sign-in?confirmed=1');
      } catch (error) {
        if (!active) return;
        setFailed(true);
        setMessage(error instanceof Error ? error.message : 'Unable to complete this email link.');
      }
    }

    void Linking.getInitialURL().then((url) => {
      if (url) void finish(url);
      else if (params.code) void finish(`sahabaquest://auth/callback?code=${encodeURIComponent(params.code)}&type=${params.type || ''}`);
      else if (params.error_description) {
        setFailed(true);
        setMessage(String(params.error_description));
      }
    });
    const subscription = Linking.addEventListener('url', ({ url }) => void finish(url));
    return () => { active = false; subscription.remove(); };
  }, [params.code, params.error_description, params.type]);

  return <Screen>
    {!failed && <ActivityIndicator color={colors.teal} />}
    <Notice message={message} success={!failed} />
    {failed && <Text style={{ color: colors.muted }}>Return to Sahaba Quest and request a fresh link if this one has expired.</Text>}
  </Screen>;
}
