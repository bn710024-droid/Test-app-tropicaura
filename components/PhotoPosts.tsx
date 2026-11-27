import React, { useCallback, useRef, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, Text, View, ViewToken } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { KeepsOwnSwipes, PAGE_SCROLL } from './PageSwipe';
import { Comments } from './Reels';
import { Sheet } from './Sheet';
import { TAB_BAR_SPACE } from './TabBar';
import { Pressable } from './Tap';
import { formatDay } from '../lib/format';
import { tick } from '../lib/haptics';
import type { PhotoPost } from '../lib/posts';
import { useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';

const LEAF = require('../assets/decor/leaf.webp');

/**
 * Une publication photo de l'équipe (référence : PhotoPosts du correctif de la tour) : une à dix
 * photos qui défilent de côté, la description dessous, J'aime et commentaires comme les vidéos.
 * Rien n'y mène à un produit. Uniquement les jetons du thème (C, F, R, PAD) et les composants de
 * l'application (Reels › Comments, Sheet, Pressable).
 */
function Post({
  post,
  width,
  liked,
  commentCount,
  onLike,
  onComments,
}: {
  post: PhotoPost;
  width: number;
  liked: boolean;
  commentCount: number;
  onLike: (id: string) => void;
  onComments: (id: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const count = post.images.length;
  const first = post.images[0];
  // La première photo donne son format à toute la publication, entre 4:5 et 1,91:1.
  const ratio =
    first.width > 0 && first.height > 0 ? Math.max(0.8, Math.min(1.91, first.width / first.height)) : 1;
  const height = Math.round(width / ratio);

  return (
    <View style={styles.post}>
      <View style={styles.head}>
        <View style={styles.avatar}>
          <Image source={LEAF} style={styles.avatarLeaf} contentFit="contain" accessible={false} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.author} numberOfLines={1}>
            Tropicaura
          </Text>
          {!!post.publishedAt && <Text style={styles.date}>{formatDay(post.publishedAt)}</Text>}
        </View>
      </View>

      {/* Les photos gardent leur glissement horizontal : il ne change pas de page. */}
      <KeepsOwnSwipes style={{ width, height, backgroundColor: '#000000' }}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          onScroll={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
          accessibilityLabel={count > 1 ? `${count} photos. Glissez de côté pour les voir.` : undefined}
        >
          {post.images.map((img, i) => (
            <Image
              key={img.url}
              source={{ uri: img.url }}
              style={{ width, height }}
              contentFit="cover"
              transition={200}
              priority={i === 0 ? 'high' : 'normal'}
              accessibilityLabel={`Photo ${i + 1} sur ${count}`}
            />
          ))}
        </ScrollView>
        {count > 1 && (
          <View style={styles.counter}>
            <Text style={styles.counterText}>
              {Math.min(index, count - 1) + 1}/{count}
            </Text>
          </View>
        )}
      </KeepsOwnSwipes>

      <View style={styles.bar}>
        <Pressable
          onPress={() => {
            tick();
            onLike(post.id);
          }}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={liked ? 'Retirer mon J’aime' : 'J’aime cette publication'}
          accessibilityState={{ selected: liked }}
          aria-pressed={liked}
          style={[styles.action, liked && styles.actionOn]}
        >
          <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? C.heart : C.text} />
          <Text style={styles.actionText}>J’aime</Text>
        </Pressable>
        <Pressable
          onPress={() => onComments(post.id)}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={commentCount > 0 ? `Commentaires, ${commentCount} de vous` : 'Commenter cette publication'}
          style={styles.action}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={19} color={C.text} />
          <Text style={styles.actionText}>{commentCount > 0 ? String(commentCount) : 'Commenter'}</Text>
        </Pressable>
        {count > 1 && (
          <View style={styles.dots}>
            {post.images.map((img, i) => (
              <View key={img.url} style={[styles.dot, i === index && styles.dotOn]} />
            ))}
          </View>
        )}
      </View>

      {!!post.description && (
        <Text style={styles.description}>
          <Text style={styles.descriptionAuthor}>Tropicaura </Text>
          {post.description}
        </Text>
      )}
    </View>
  );
}

// Une publication compte comme vue quand elle est restée à l'écran, pour l'essentiel, un instant.
const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 600 };

/**
 * Favoris › Découvrir › Photos : les publications photo de l'équipe, de la plus récente à la plus
 * ancienne. Vues, J'aime et commentaires sont transmis à l'équipe, comme pour les vidéos.
 */
export function PhotoPosts({ top }: { top: number }) {
  const { account, posts, likes, comments, markWatched, toggleLike, addComment, removeComment } = useStore();
  const { width, bottom } = useFrame();
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const current = commentsFor ? posts.find((p) => p.id === commentsFor) : undefined;

  const seen = useRef(markWatched);
  seen.current = markWatched;
  const onViewable = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const v of viewableItems) {
      if (v.isViewable && typeof v.key === 'string') seen.current(v.key);
    }
  }, []);

  return (
    <>
      <FlatList
        data={posts}
        style={[PAGE_SCROLL, { backgroundColor: C.bg }]}
        keyExtractor={(p) => p.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: top, paddingBottom: TAB_BAR_SPACE + bottom + 16 }}
        viewabilityConfig={VIEWABILITY}
        onViewableItemsChanged={onViewable}
        accessibilityLabel="Photos de notre équipe"
        renderItem={({ item }) => (
          <Post
            post={item}
            width={width}
            liked={likes.includes(item.id)}
            commentCount={(comments[item.id] ?? []).length}
            onLike={toggleLike}
            onComments={setCommentsFor}
          />
        )}
      />
      <Sheet visible={!!current} onClose={() => setCommentsFor(null)} title="Commentaires">
        {current && (
          <Comments
            empty="Aucun commentaire sur cette publication. Écrivez le premier."
            list={comments[current.id] ?? []}
            name={account?.name ?? ''}
            onAdd={(text) => addComment(current.id, text)}
            onRemove={(id) => removeComment(current.id, id)}
          />
        )}
      </Sheet>
    </>
  );
}

// Jetons du thème et valeurs déjà employées par Reels (voile 0,78, points 0,2) : aucun style nouveau.
const styles = StyleSheet.create({
  post: { marginBottom: 26 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: PAD, paddingBottom: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  avatarLeaf: { width: 17, height: 17 },
  author: { color: C.text, fontFamily: F.heavy, fontSize: 14.5, lineHeight: 19 },
  date: { color: C.textFaint, fontFamily: F.medium, fontSize: 12, lineHeight: 16 },
  counter: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: 'rgba(11,14,9,0.78)',
    pointerEvents: 'none',
  },
  counterText: { color: C.text, fontFamily: F.bold, fontSize: 12.5, fontVariant: ['tabular-nums'] },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: PAD - 4, paddingTop: 10 },
  action: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 14,
    borderRadius: R.pill,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  actionOn: { backgroundColor: C.surfaceStrong, borderColor: C.lineStrong },
  actionText: { color: C.text, fontFamily: F.bold, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  dots: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 5, paddingRight: 4 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'rgba(245,242,233,0.2)' },
  dotOn: { width: 16, backgroundColor: C.leaf },
  description: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 14.5,
    lineHeight: 22,
  },
  descriptionAuthor: { color: C.text, fontFamily: F.heavy },
});
