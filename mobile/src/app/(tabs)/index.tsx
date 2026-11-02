import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { Button, Card, FadeIn, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type DashboardData = {
  displayName: string;
  accountType: string;
  level: number;
  xp: number;
  streak: number;
  quest: { title: string; description: string; status: string; question_count: number; questions_answered: number; daily_streak: number } | null;
  featuredChallenges: { id: string; title: string; description: string; icon: string | null; question_count: number; time_per_question: number }[];
};

export default function HomeTab() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setMessage('');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      setMessage(userError?.message || 'Sign in again to load your dashboard.');
      setLoading(false);
      return;
    }
    const [{ data: profile }, { data: progress }, { data: quest }, { data: challenges }] = await Promise.all([
      supabase.from('profiles').select('display_name, username, account_type').eq('id', user.id).maybeSingle(),
      supabase.from('player_progress').select('current_level, total_xp, current_streak').eq('user_id', user.id).maybeSingle(),
      supabase.rpc('get_daily_quest_status'),
      supabase.from('challenges').select('id,title,description,icon,question_count,time_per_question').eq('is_active', true).order('sort_order').limit(2),
    ]);
    const questRow = Array.isArray(quest) ? quest[0] : quest;
    setData({
      displayName: profile?.display_name || profile?.username || user.email?.split('@')[0] || 'Player',
      accountType: profile?.account_type || 'free',
      level: progress?.current_level || 1,
      xp: progress?.total_xp || 0,
      streak: progress?.current_streak || 0,
      quest: questRow?.quest_id ? {
        title: questRow.title || 'Daily Quest',
        description: questRow.description || '',
        status: questRow.status || 'not_started',
        question_count: Number(questRow.question_count || 0),
        questions_answered: Number(questRow.questions_answered || 0),
        daily_streak: Number(questRow.daily_streak || 0),
      } : null,
      featuredChallenges: challenges || [],
    });
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;

  const questProgress = data?.quest && data.quest.question_count > 0 ? Math.min(1, data.quest.questions_answered / data.quest.question_count) : 0;
  const questDone = data?.quest?.status === 'completed';
  const questInProgress = data?.quest?.status === 'in_progress';

  return <Screen refreshing={refreshing} onRefresh={() => void refresh()}>
    <Notice message={message} />
    {data ? <>
      <FadeIn><View style={styles.welcome}><View style={styles.welcomeIcon}><SymbolView name={{ ios: 'sparkles', android: 'auto_awesome' }} size={20} tintColor={colors.teal} /></View><Text style={styles.eyebrow}>YOUR LEARNING JOURNEY</Text><Text style={styles.greeting}>As-salamu alaykum, <Text style={styles.name}>{data.displayName}!</Text></Text><Text style={styles.subtitle}>Ready for today's learning journey? Keep learning, grow your knowledge, and build your streak.</Text></View></FadeIn>
      <FadeIn delay={50}><Card style={styles.hero}>
        <View style={styles.heroTop}><View style={styles.heroIcon}><SymbolView name={{ ios: 'book.closed.fill', android: 'auto_stories' }} size={23} tintColor="#fff" /></View><Text style={styles.eyebrow}>YOUR QUEST · {data.accountType.toUpperCase()} ACCOUNT</Text></View>
        <Text style={styles.heroTitle}>Grow your knowledge, one answer at a time.</Text>
        <Text style={styles.heroCopy}>Learn about the Sahabah, earn XP, and take the next step in your journey.</Text>
        <Button title="Start a quiz  →" onPress={() => router.push('/(tabs)/quiz')} />
      </Card></FadeIn>
      <View style={styles.statRow}>
        <FadeIn delay={90} style={styles.statWrap}><Card style={styles.stat}><SymbolView name={{ ios: 'star.circle.fill', android: 'military_tech' }} size={23} tintColor={colors.teal} /><Text style={uiStyles.statValue}>{data.level}</Text><Text style={uiStyles.statLabel}>Level</Text></Card></FadeIn>
        <FadeIn delay={130} style={styles.statWrap}><Card style={styles.stat}><SymbolView name={{ ios: 'bolt.fill', android: 'bolt' }} size={23} tintColor={colors.gold} /><Text style={uiStyles.statValue}>{data.xp.toLocaleString()}</Text><Text style={uiStyles.statLabel}>Total XP</Text></Card></FadeIn>
        <FadeIn delay={170} style={styles.statWrap}><Card style={styles.stat}><SymbolView name={{ ios: 'flame.fill', android: 'local_fire_department' }} size={23} tintColor="#E28A24" /><Text style={uiStyles.statValue}>{data.streak}</Text><Text style={uiStyles.statLabel}>Day streak</Text></Card></FadeIn>
      </View>
      <FadeIn delay={210}><Card style={styles.dailyCard}>
        <View style={styles.dailyHeader}><View style={styles.dailyIcon}><SymbolView name={{ ios: 'calendar.badge.clock', android: 'event_available' }} size={22} tintColor={colors.teal} /></View><View style={styles.dailyCopy}><Text style={styles.sectionTitle}>{questDone ? 'Daily Quest complete' : questInProgress ? 'Continue your Daily Quest' : 'Your Daily Quest awaits'}</Text><Text style={uiStyles.smallMuted}>{data.quest?.title || 'A fresh set of Sahaba Quest questions each day.'}</Text></View></View>
        {data.quest?.description ? <Text style={uiStyles.smallMuted}>{data.quest.description}</Text> : null}
        {data.quest && data.quest.question_count > 0 ? <>
          <View style={styles.questMeta}><Text style={styles.questMetaText}>{data.quest.questions_answered} / {data.quest.question_count} questions</Text>{data.quest.daily_streak > 0 ? <Text style={styles.questMetaText}>🔥 {data.quest.daily_streak} day streak</Text> : null}</View>
          <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(questProgress * 100) }} style={styles.questTrack}><View style={[styles.questBar, { width: `${Math.round(questProgress * 100)}%` }]} /></View>
        </> : null}
        <Text style={[styles.questState, questDone && styles.questDone]}>{questDone ? 'Completed today' : questInProgress ? 'In progress' : 'Ready when you are'}</Text>
        <Button title={questDone ? 'Review today’s quest →' : questInProgress ? 'Continue quest →' : 'Start today’s quest →'} onPress={() => router.push('/daily-quest')} />
      </Card></FadeIn>
      <FadeIn delay={250}><Card style={styles.quickCard}>
        <Text style={styles.sectionTitle}>Keep your momentum</Text>
        <Text style={uiStyles.smallMuted}>Try a timed challenge or see how your learning compares with other players.</Text>
        <View style={styles.quickActions}><Button title="Challenges" secondary onPress={() => router.push('/(tabs)/challenges')} /><Button title="Leaderboard" secondary onPress={() => router.push('/(tabs)/leaderboard')} /></View>
      </Card></FadeIn>
      {data.featuredChallenges.length ? <FadeIn delay={270}><Card>
        <View style={styles.challengeHeader}><Text style={styles.sectionTitle}>Challenges to explore</Text><Button title="See all" secondary onPress={() => router.push('/(tabs)/challenges')} /></View>
        {data.featuredChallenges.map((challenge) => <View key={challenge.id} style={styles.featuredChallenge}><Text style={styles.challengeIcon}>{challenge.icon || '🏆'}</Text><View style={styles.challengeInfo}><Text style={styles.challengeTitle}>{challenge.title}</Text><Text numberOfLines={2} style={uiStyles.smallMuted}>{challenge.description}</Text><Text style={styles.challengeMeta}>{challenge.question_count} questions · {challenge.time_per_question}s each</Text></View></View>)}
      </Card></FadeIn> : null}
      <FadeIn delay={290}><Card style={styles.sponsoredCard}>
        <Text style={styles.sectionTitle}>Sponsored competitions</Text>
        <Text style={uiStyles.smallMuted}>Take part in special competitions. Individual Plus eligibility is checked before you can join.</Text>
        <Button title="Explore competitions →" secondary onPress={() => router.push('/sponsored')} />
      </Card></FadeIn>
    </> : null}
  </Screen>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', backgroundColor: colors.background },
  welcome: { gap: 8, paddingTop: 4 },
  welcomeIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  greeting: { color: colors.ink, fontSize: 28, lineHeight: 34, fontWeight: '900', letterSpacing: -0.7 },
  name: { color: colors.teal },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  hero: { backgroundColor: '#E8F7F3', paddingVertical: 22, borderColor: '#C8E8DF' },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: colors.teal, alignItems: 'center', justifyContent: 'center' },
  eyebrow: { color: colors.teal, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  heroTitle: { color: colors.ink, fontSize: 24, lineHeight: 30, fontWeight: '900' },
  heroCopy: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  statRow: { flexDirection: 'row', gap: 9 },
  statWrap: { flex: 1, minWidth: 0 },
  stat: { paddingHorizontal: 8, paddingVertical: 14, alignItems: 'center' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  questState: { color: colors.teal, fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },
  questDone: { color: colors.success },
  dailyCard: { borderColor: '#C8E8DF' },
  dailyHeader: { flexDirection: 'row', gap: 11, alignItems: 'center' },
  dailyIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  dailyCopy: { flex: 1, gap: 3 },
  questMeta: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  questMetaText: { color: colors.tealDark, fontSize: 12, fontWeight: '800' },
  questTrack: { height: 8, overflow: 'hidden', borderRadius: 8, backgroundColor: '#E1ECE8' },
  questBar: { height: '100%', borderRadius: 8, backgroundColor: colors.teal },
  quickCard: { backgroundColor: '#FBFDFC' },
  quickActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  challengeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  featuredChallenge: { flexDirection: 'row', alignItems: 'flex-start', gap: 11, paddingTop: 9, borderTopWidth: 1, borderTopColor: colors.border },
  challengeIcon: { fontSize: 24 },
  challengeInfo: { flex: 1, gap: 3 },
  challengeTitle: { color: colors.ink, fontWeight: '800' },
  challengeMeta: { color: colors.tealDark, fontSize: 11, fontWeight: '700' },
  sponsoredCard: { backgroundColor: '#F2F8FA' },
});
