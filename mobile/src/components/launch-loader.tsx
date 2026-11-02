import { useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '@/lib/theme';

export function LaunchLoader() {
  const opacity = useRef(new Animated.Value(0)).current;
  const [stage, setStage] = useState(0);

  useEffect(() => {
    Animated.timing(opacity, { toValue: 1, duration: 520, useNativeDriver: true }).start();
    const first = setTimeout(() => setStage(1), 900);
    const second = setTimeout(() => setStage(2), 1800);
    return () => { clearTimeout(first); clearTimeout(second); };
  }, [opacity]);

  return <View style={styles.container}>
    <Animated.View style={[styles.content, { opacity }]}>
      {stage === 0 ? <>
        <Text style={styles.companyLabel}>A product of</Text>
        <Text style={styles.companyName}>Deen Skyline Limited</Text>
      </> : <>
        <Image source={require('@/assets/images/icon.png')} style={styles.logo} />
        <Text style={styles.name}>Sahaba Quest</Text>
        <Text style={styles.tagline}>LEARN · REMEMBER · COMPETE</Text>
        {stage === 2 ? <Text style={styles.loading}>Preparing your learning journey…</Text> : null}
      </>}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  content: { alignItems: 'center', gap: 13 },
  companyLabel: { color: colors.muted, fontSize: 13 },
  companyName: { color: colors.ink, fontSize: 21, fontWeight: '900' },
  logo: { width: 86, height: 86, borderRadius: 22 },
  name: { color: colors.ink, fontSize: 24, fontWeight: '900' },
  tagline: { color: colors.teal, fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  loading: { marginTop: 18, color: colors.muted, fontSize: 13 },
});
