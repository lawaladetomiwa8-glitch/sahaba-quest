import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Card, Heading, Notice, Screen, uiStyles } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

type Article = { id: string; title: string; subtitle: string | null; slug: string; companion_name: string | null; summary: string; content: string; category: string; tags: string[]; cover_image_url: string | null; cover_image_alt: string | null; source_references: { title: string; detail?: string; url?: string | null }[] };

export default function SahabaArticleScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(0);
  const [comments, setComments] = useState<{ id: string; author_name: string; content: string; created_at: string }[]>([]);
  const [commentText, setCommentText] = useState('');
  const [engagementMessage, setEngagementMessage] = useState('');
  const [engagementBusy, setEngagementBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void supabase.from('sahabah_articles').select('id,title,subtitle,slug,companion_name,summary,content,category,tags,cover_image_url,cover_image_alt,source_references').eq('slug', slug).eq('status', 'published').maybeSingle().then(({ data, error }) => {
      if (!active) return;
      setArticle(data as Article | null);
      if (error) setMessage(error.message);
      else if (!data) setMessage('This published story is unavailable.');
      setLoading(false);
    });
    return () => { active = false; };
  }, [slug]);
  useEffect(() => {
    if (!article) return;
    let active = true;
    void (async () => {
      const [{ data: { user } }, likeRows, commentRows] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('sahabah_article_likes').select('id', { count: 'exact', head: true }).eq('article_id', article.id),
        supabase.from('sahabah_article_comments').select('id,author_name,content,created_at').eq('article_id', article.id).order('created_at', { ascending: false }).limit(100),
      ]);
      if (!active) return;
      setUserId(user?.id || null);
      if (likeRows.error || commentRows.error) setEngagementMessage('Likes and comments could not be loaded.');
      else { setLikes(likeRows.count || 0); setComments(commentRows.data || []); }
      if (user) {
        const { data } = await supabase.from('sahabah_article_likes').select('id').eq('article_id', article.id).eq('user_id', user.id).maybeSingle();
        if (active) setLiked(Boolean(data));
      }
    })();
    return () => { active = false; };
  }, [article]);
  async function toggleLike() {
    if (!userId) { setEngagementMessage('Sign in to like this article.'); return; }
    setEngagementBusy(true); setEngagementMessage('');
    const request = liked
      ? await supabase.from('sahabah_article_likes').delete().eq('article_id', article?.id).eq('user_id', userId)
      : await supabase.from('sahabah_article_likes').insert({ article_id: article?.id, user_id: userId });
    setEngagementBusy(false);
    if (request.error) setEngagementMessage('Your like could not be updated. Please try again.');
    else { setLiked(!liked); setLikes((current) => Math.max(0, current + (liked ? -1 : 1))); }
  }
  async function postComment() {
    const content = commentText.trim();
    if (!userId) { setEngagementMessage('Sign in to comment on this article.'); return; }
    if (!content) { setEngagementMessage('Write a comment first.'); return; }
    setEngagementBusy(true); setEngagementMessage('');
    const { error } = await supabase.from('sahabah_article_comments').insert({ article_id: article?.id, user_id: userId, content });
    if (error) setEngagementMessage('Your comment could not be posted. Please try again.');
    else {
      setCommentText('');
      const { data } = await supabase.from('sahabah_article_comments').select('id,author_name,content,created_at').eq('article_id', article?.id).order('created_at', { ascending: false }).limit(100);
      setComments(data || []);
      setEngagementMessage('Your comment has been added.');
    }
    setEngagementBusy(false);
  }
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.teal} /></View>;
  if (!article) return <Screen><Heading title="Story unavailable" /><Notice message={message} /><Button title="Back to Sahaba library" onPress={() => router.replace('/sahaba')} /></Screen>;
  const paragraphs = article.content.split(/\n{2,}/).map((part) => part.replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1').trim()).filter(Boolean);
  return <Screen>
    <Button title="← Sahaba library" secondary onPress={() => router.back()} />
    {article.cover_image_url ? <Image source={{ uri: article.cover_image_url }} accessibilityLabel={article.cover_image_alt || article.title} style={styles.cover} resizeMode="cover" /> : null}
    <Heading title={article.title} subtitle={article.subtitle || undefined} />
    <Text style={styles.category}>{article.category}</Text>
    {article.companion_name ? <Text style={styles.companion}>Companion · {article.companion_name}</Text> : null}
    <Card style={styles.summary}><Text style={styles.summaryText}>{article.summary}</Text></Card>
    <Card>{paragraphs.map((paragraph, index) => <Text key={index} style={styles.paragraph}>{paragraph}</Text>)}</Card>
    {article.source_references?.length ? <Card><Text style={styles.sources}>Sources and references</Text>{article.source_references.map((ref, index) => <View key={`${ref.title}-${index}`} style={styles.reference}><Text style={styles.refTitle}>{ref.title}</Text>{ref.detail ? <Text style={uiStyles.smallMuted}>{ref.detail}</Text> : null}{ref.url ? <Text style={styles.url}>{ref.url}</Text> : null}</View>)}</Card> : null}
    <Card><Text style={styles.sources}>Enjoyed this article?</Text><Text style={uiStyles.smallMuted}>Share what you have learned and help others discover the lives of the Sahabah.</Text><View style={styles.engagementActions}><Button title={(liked ? '♥ Liked' : '♡ Like') + ' · ' + likes} secondary disabled={engagementBusy} onPress={() => void toggleLike()} /><Button title="Share" secondary onPress={() => void Share.share({ title: article.title, message: 'Read this Sahaba Quest article: ' + article.title + ' https://sahabaquest.com.ng/sahaba/' + article.slug })} /><Button title="WhatsApp" secondary onPress={() => void Linking.openURL('https://wa.me/?text=' + encodeURIComponent('Read this Sahaba Quest article: ' + article.title + ' https://sahabaquest.com.ng/sahaba/' + article.slug))} /></View>{!userId && <Button title="Sign in to like or comment" secondary onPress={() => router.push('/sign-in')} />}<TextInput multiline value={commentText} onChangeText={setCommentText} placeholder="Write a comment" placeholderTextColor={colors.muted} style={styles.commentInput} /><Button title={engagementBusy ? 'Posting…' : 'Post comment'} disabled={engagementBusy || !commentText.trim()} onPress={() => void postComment()} /><Notice message={engagementMessage} success={engagementMessage === 'Your comment has been added.'} />{comments.map((comment) => <View key={comment.id} style={styles.comment}><Text style={styles.refTitle}>{comment.author_name}</Text><Text style={styles.paragraph}>{comment.content}</Text><Text style={uiStyles.smallMuted}>{new Date(comment.created_at).toLocaleDateString()}</Text></View>)}</Card>
  </Screen>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, cover: { width: '100%', height: 210, borderRadius: 18, backgroundColor: colors.mint }, category: { color: colors.teal, textTransform: 'uppercase', fontSize: 11, fontWeight: '900', letterSpacing: 1 }, companion: { color: colors.muted, fontWeight: '700' }, summary: { backgroundColor: colors.mint }, summaryText: { color: colors.tealDark, fontSize: 16, lineHeight: 25, fontWeight: '700' }, paragraph: { color: colors.ink, fontSize: 16, lineHeight: 26 }, sources: { color: colors.ink, fontSize: 18, fontWeight: '900' }, reference: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 4 }, refTitle: { color: colors.ink, fontWeight: '800' }, url: { color: colors.teal, fontSize: 12 }, engagementActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, commentInput: { minHeight: 85, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, textAlignVertical: 'top', color: colors.ink }, comment: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, gap: 4 } });
