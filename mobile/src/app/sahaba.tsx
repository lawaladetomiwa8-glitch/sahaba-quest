import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Article = { id: string; title: string; subtitle: string | null; slug: string; companion_name: string | null; summary: string; category: string; tags: string[]; cover_image_url: string | null };

export default function SahabaLibraryScreen() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await supabase.from('sahabah_articles').select('id,title,subtitle,slug,companion_name,summary,category,tags,cover_image_url').eq('status', 'published').order('published_at', { ascending: false });
    if (error) setMessage(`Published profiles could not be loaded: ${error.message}`);
    setArticles((data || []) as Article[]); setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  const filtered = articles.filter((article) => `${article.title} ${article.companion_name || ''} ${article.summary} ${(article.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase()));
  return <Screen>
    <Heading title="The Noble Sahaba" subtitle="Discover published stories and lessons from the lives of the Companions. This library uses the same published articles available on the website." />
    <Notice message={message} />
    <TextInput value={query} onChangeText={setQuery} placeholder="Search companions and stories" placeholderTextColor={colors.muted} style={styles.search} />
    {loading ? <ActivityIndicator color={colors.teal} /> : filtered.length ? filtered.map((article) => <Card key={article.id}>
      <Text style={styles.category}>{article.category || 'Sahabah Article'}</Text>
      <Text style={styles.title}>{article.title}</Text>
      {article.subtitle ? <Text style={styles.subtitle}>{article.subtitle}</Text> : null}
      {article.companion_name ? <Text style={styles.companion}>Companion · {article.companion_name}</Text> : null}
      <Text style={uiStyles.smallMuted}>{article.summary}</Text>
      {(article.tags || []).length > 0 ? <View style={styles.tags}>{article.tags.slice(0, 4).map((tag) => <Text key={tag} style={styles.tag}>{tag}</Text>)}</View> : null}
      <Button title="Read story →" onPress={() => router.push({ pathname: '/sahaba-article/[slug]', params: { slug: article.slug } })} />
    </Card>) : <Card><Text style={uiStyles.smallMuted}>{articles.length ? 'No published stories match your search.' : 'There are no published stories yet.'}</Text></Card>}
    <Button title="Refresh library" secondary onPress={() => { setLoading(true); void load(); }} />
  </Screen>;
}

const styles = StyleSheet.create({ search: { minHeight: 50, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border, borderRadius: 13, paddingHorizontal: 14, color: colors.ink }, category: { color: colors.teal, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 }, title: { color: colors.ink, fontSize: 21, fontWeight: '900' }, subtitle: { color: colors.muted, fontWeight: '700' }, companion: { color: colors.tealDark, fontSize: 13, fontWeight: '800' }, tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 }, tag: { color: colors.tealDark, backgroundColor: colors.mint, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 12, fontSize: 11, fontWeight: '700' } });
