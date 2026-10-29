import { useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { colors } from '@/lib/theme';

const siteKey = process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY || '';
const widgetHost = process.env.EXPO_PUBLIC_TURNSTILE_HOST || 'https://sahabaquest.com.ng';

export function TurnstileChallenge({ onToken }: { onToken: (token: string | null) => void }) {
  const [loaded, setLoaded] = useState(false);
  const html = useMemo(() => `<!doctype html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1" />
<style>html,body{margin:0;padding:0;background:transparent;font-family:system-ui}#challenge{min-height:66px;display:flex;align-items:center;justify-content:center}</style>
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit" async defer></script>
</head><body><div id="challenge"></div><script>
const send=(v)=>window.ReactNativeWebView.postMessage(JSON.stringify(v));
window.onload=()=>{const timer=setInterval(()=>{if(!window.turnstile)return;clearInterval(timer);window.turnstile.render('#challenge',{sitekey:'${siteKey}',callback:(token)=>send({token}),'expired-callback':()=>send({token:null}),'error-callback':()=>send({error:true})});},100);setTimeout(()=>clearInterval(timer),15000)};
</script></body></html>`, []);

  function handleMessage(event: WebViewMessageEvent) {
    try {
      const message = JSON.parse(event.nativeEvent.data) as { token?: string | null; error?: boolean };
      onToken(message.token || null);
    } catch {
      onToken(null);
    }
  }

  if (!siteKey) {
    return <Text style={styles.warning}>Add EXPO_PUBLIC_TURNSTILE_SITE_KEY to mobile/.env before using sign in or sign up.</Text>;
  }

  return (
    <View style={styles.wrapper}>
      {!loaded && <ActivityIndicator color={colors.teal} style={styles.loader} />}
      <WebView
        source={{ html, baseUrl: widgetHost }}
        originWhitelist={['https://*', 'http://*', 'about:blank', 'about:srcdoc']}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        sharedCookiesEnabled
        onLoadEnd={() => setLoaded(true)}
        onMessage={handleMessage}
        style={styles.webview}
        scrollEnabled={false}
        automaticallyAdjustContentInsets={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { height: 72, justifyContent: 'center', overflow: 'hidden' },
  webview: { backgroundColor: 'transparent' },
  loader: { position: 'absolute', zIndex: 1, alignSelf: 'center' },
  warning: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
