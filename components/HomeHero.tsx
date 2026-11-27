import React, { useEffect, useMemo, useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pressable } from './Tap';
import Animated, {
  Easing,
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Glow } from './Glow';
import { PressableScale } from './PressableScale';
import { CAMPAIGNS, PRODUCT_BY_ID, Campaign, Photo, Product } from '../lib/data';
import { campaignActive, fromMonth, isInSeason, nextSeasonStart } from '../lib/format';
import { RATIO } from '../lib/ratios';
import { C, F, R, shadow } from '../lib/theme';
import { tick } from '../lib/haptics';

const LEAF_SOFT = require('../assets/decor/leaf-soft.webp');
const LEAF_BLUR = require('../assets/decor/leaf-blur.webp');

const HEIGHT = 256;
const AUTO_MS = 6000;

type Slide = {
  key: string;
  /** Produit de la campagne : le bandeau ouvre sa fiche ; `null` : image seule. */
  id: string | null;
  /** Annonce illustrée : bouton, toucher l'image (`tap`) ou image seule (`none`). */
  link: 'button' | 'tap' | 'none';
  kicker: string;
  title: string;
  accent: string;
  body: string;
  cta: string;
  back?: Product;
  /** Image de fond plein cadre de l'annonce, si elle est fournie. */
  photo?: Photo;
};

/**
 * Une diapositive par campagne DIFFUSÉE : les annonces éteintes (`enabled: false`) ou hors
 * de leur période (`startsAt`/`endsAt`) ne sont jamais construites ni affichées.
 */
export function buildSlides(
  campaigns: Campaign[] = CAMPAIGNS,
  // Produits du catalogue affiché (publié par la tour) ; par défaut, ceux de l'application.
  products: Record<string, Product> = PRODUCT_BY_ID,
): Slide[] {
  return campaigns.filter((c) => campaignActive(c) && (c.id ? products[c.id] : c.photo)).map((c, i) => {
    const product = c.id ? products[c.id] : undefined;
    if (!product) {
      // Image seule publiée par l'équipe : aucun produit, aucun texte, aucun bouton.
      return { key: c.key ?? `image-${i}`, id: null, link: 'none', kicker: '', title: '', accent: '', body: c.body, cta: '', photo: c.photo };
    }
    const article = /^[aeiouyéèêh]/i.test(product.name)
      ? 'l’'
      : product.name.endsWith('e')
        ? 'la '
        : 'le ';
    return {
      key: c.key ?? product.id,
      id: product.id,
      link: c.photo ? (c.link === 'tap' ? 'tap' : 'button') : 'button',
      // Textes de l'annonce : fournis par la campagne, sinon déduits du produit.
      kicker:
        c.kicker ??
        (isInSeason(product)
          ? 'Campagne en cours'
          : `Campagne à venir · ${fromMonth(nextSeasonStart(product))}`),
      title: c.title ?? product.name,
      accent: c.accent,
      body: c.body,
      cta: c.cta ?? `Voir ${article}${product.name.toLowerCase()}`,
      back: product,
      photo: c.photo,
    };
  });
}

function SlideView({
  slide,
  index,
  width,
  scrollX,
  float,
  onPress,
}: {
  slide: Slide;
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  float: SharedValue<number>;
  onPress: () => void;
}) {
  const compact = width < 310;
  // Le dernier mot de l'accent passe en or : « du » crème, « Sénégal » doré.
  const sep = slide.accent.lastIndexOf(' ');
  const accentPre = sep > 0 ? slide.accent.slice(0, sep + 1) : '';
  const accentWord = sep > 0 ? slide.accent.slice(sep + 1) : slide.accent;

  // Arrière-plan : grand, cadré serré, il déborde du bord droit de la carte.
  const back = slide.back;
  // Annonce illustrée sans bouton (toucher l'image, ou image seule) : l'image se suffit à elle-même.
  const imageOnly = !!slide.photo && slide.link !== 'button';
  const backRatio = back ? (RATIO[back.id] ?? 1) : 1;
  const backW = Math.min(HEIGHT * 0.8 * backRatio, width * 0.66);
  const backH = backW / backRatio;

  const backStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: (scrollX.value - index * width) * 0.26 },
      { translateY: (float.value - 0.5) * -8 },
      { rotate: `${(float.value - 0.5) * 2.4}deg` },
    ],
  }));
  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(index - 0.6) * width, index * width, (index + 0.6) * width],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));

  return (
    <Pressable
      feedback="none"
      onPress={slide.link === 'none' ? undefined : onPress}
      accessible={imageOnly}
      accessibilityRole={slide.link === 'tap' ? 'button' : 'image'}
      accessibilityLabel={imageOnly ? (slide.link === 'tap' ? slide.cta : slide.body || 'Annonce') : undefined}
      style={{ width, height: HEIGHT, overflow: 'hidden' }}
    >
      <View style={[StyleSheet.absoluteFill, { pointerEvents: 'none' }]}>
        {slide.photo ? (
          // Annonce illustrée : la photo occupe tout le bandeau, le texte reste lisible
          // grâce aux deux voiles (gauche pour la copie, bas pour les points).
          <>
            <Image
              source={slide.photo}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              priority={index === 0 ? 'high' : 'normal'}
              accessible={false}
            />
            {!imageOnly && (
            <LinearGradient
              colors={['rgba(10,13,8,0.95)', 'rgba(10,13,8,0.62)', 'rgba(10,13,8,0.08)']}
              locations={[0, 0.45, 0.82]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            )}
            {!imageOnly && (
            <LinearGradient
              colors={['rgba(10,13,8,0)', 'rgba(10,13,8,0.62)']}
              locations={[0.55, 1]}
              style={StyleSheet.absoluteFill}
            />
            )}
          </>
        ) : back ? (
          <>
        <Glow
          color={back.tint}
          width={HEIGHT * 1.7}
          opacity={0.46}
          style={{ right: -HEIGHT * 0.62, top: -HEIGHT * 0.36 }}
        />
        <Image
          source={LEAF_SOFT}
          style={[styles.leafTop, { right: backW * 0.34 }]}
          contentFit="contain"
          accessible={false}
        />
        <Animated.View
          style={[
            {
              position: 'absolute',
              width: backW,
              height: backH,
              right: -backW * (compact ? 0.34 : 0.22),
              top: (HEIGHT - backH) * 0.36,
            },
            backStyle,
          ]}
        >
          <Image
            source={back.image}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
            priority={index === 0 ? 'high' : 'normal'}
            accessible={false}
          />
        </Animated.View>

        {/* Voile latéral : garantit la lisibilité du texte sur les visuels. */}
        <LinearGradient
          colors={['rgba(16,20,12,0.96)', 'rgba(16,20,12,0.78)', 'rgba(16,20,12,0)']}
          locations={[0, 0.4, 0.74]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />

        <Image
          source={LEAF_BLUR}
          style={styles.leafCorner}
          contentFit="contain"
          accessible={false}
        />
          </>
        ) : null}
      </View>

      {!imageOnly && (
      <Animated.View style={[styles.copy, textStyle]}>
        <Text style={styles.kicker} numberOfLines={1}>
          {slide.kicker}
        </Text>
        <View style={styles.kickerRule} />
        <Text style={[styles.title, compact && styles.titleCompact]} accessibilityRole="header">
          {slide.title}
          {'\n'}
          <Text style={styles.accent}>{accentPre}</Text>
          <Text style={styles.accentGold}>{accentWord}</Text>
        </Text>
        <Text style={[styles.body, { maxWidth: Math.max(width * 0.47, 150) }]} numberOfLines={2}>
          {slide.body}
        </Text>
        <PressableScale
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={slide.cta}
          style={styles.cta}
        >
          <Text style={styles.ctaText}>{slide.cta}</Text>
          <Ionicons name="chevron-forward" size={15} color={C.leaf} />
        </PressableScale>
      </Animated.View>
      )}
    </Pressable>
  );
}

function Dot({
  index,
  width,
  scrollX,
  total,
  onPress,
}: {
  index: number;
  width: number;
  scrollX: SharedValue<number>;
  total: number;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => {
    const on = interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP,
    );
    return { width: 6 + on * 14, opacity: 0.38 + on * 0.62 };
  });
  const active = useAnimatedStyle(() => ({
    opacity: interpolate(
      scrollX.value,
      [(index - 1) * width, index * width, (index + 1) * width],
      [0, 1, 0],
      Extrapolation.CLAMP,
    ),
  }));
  return (
    <Pressable
      onPress={onPress}
      hitSlop={{ top: 12, bottom: 12, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`Afficher la campagne ${index + 1} sur ${total}`}
      style={styles.dotHit}
    >
      <Animated.View style={[styles.dot, style]}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.dotOn, active]} />
      </Animated.View>
    </Pressable>
  );
}

/** Bandeau d'accueil : annonce les campagnes de produits, à venir ou en cours. */
export function HomeHero({
  width,
  onOpen,
  campaigns,
  products,
}: {
  width: number;
  onOpen: (id: string) => void;
  campaigns?: Campaign[];
  products?: Record<string, Product>;
}) {
  const slides = useMemo(() => buildSlides(campaigns, products), [campaigns, products]);
  const ref = useRef<ScrollView>(null);
  const scrollX = useSharedValue(0);
  const float = useSharedValue(0.5);
  const page = useRef(0);
  const touched = useRef(false);
  const reduced = useReducedMotion();

  const goTo = (i: number) => ref.current?.scrollTo({ x: i * width, animated: true });

  useEffect(() => {
    if (reduced) return;
    float.value = withDelay(
      400,
      withRepeat(withTiming(1, { duration: 3600, easing: Easing.inOut(Easing.sin) }), -1, true),
    );
    // Défilement automatique, abandonné dès que l'on prend la main.
    const id = setInterval(() => {
      if (touched.current) return;
      ref.current?.scrollTo({ x: ((page.current + 1) % slides.length) * width, animated: true });
    }, AUTO_MS);
    return () => clearInterval(id);
  }, [reduced, float, slides.length, width]);

  // Aucune annonce diffusée : le bandeau disparaît entièrement, sans cadre vide.
  if (slides.length === 0) return null;

  return (
    <View style={[styles.card, shadow(18, 40, 0.45), { width, height: HEIGHT }]}>
      <View style={styles.clip}>
        <LinearGradient
          colors={['#222A16', '#141910', '#0E120B']}
          locations={[0, 0.55, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          decelerationRate="fast"
          onScrollBeginDrag={() => {
            touched.current = true;
          }}
          onScroll={(e) => {
            const x = e.nativeEvent.contentOffset.x;
            scrollX.value = x;
            page.current = Math.round(x / width);
          }}
        >
          {slides.map((s, i) => (
            <SlideView
              key={s.key}
              slide={s}
              index={i}
              width={width}
              scrollX={scrollX}
              float={float}
              onPress={() => {
                tick();
                touched.current = true;
                if (s.id) onOpen(s.id);
              }}
            />
          ))}
        </ScrollView>
        <View style={styles.dots}>
          {slides.map((s, i) => (
            <Dot
              key={s.key}
              index={i}
              width={width}
              scrollX={scrollX}
              total={slides.length}
              onPress={() => {
                touched.current = true;
                goTo(i);
              }}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: R.xl, backgroundColor: C.raised },
  clip: {
    flex: 1,
    borderRadius: R.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(168,213,79,0.2)',
    // Safari : sans cela, les coins arrondis ne découpent pas les visuels animés.
    ...(Platform.OS === 'web' ? ({ isolation: 'isolate' } as object) : null),
  },
  leafTop: {
    position: 'absolute',
    top: -34,
    width: 104,
    height: 104,
    transform: [{ rotate: '34deg' }],
  },
  leafCorner: {
    position: 'absolute',
    right: -66,
    bottom: -70,
    width: 132,
    height: 132,
    transform: [{ rotate: '-128deg' }],
  },
  copy: { position: 'absolute', left: 20, top: 22, right: 20 },
  kicker: {
    color: C.leaf,
    fontFamily: F.heavy,
    fontSize: 11.5,
    lineHeight: 16,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  kickerRule: { marginTop: 6, width: 42, height: 3, borderRadius: 2, backgroundColor: C.leaf },
  accentGold: { fontFamily: F.displayItalic, color: '#F0B429' },
  title: {
    marginTop: 8,
    color: C.text,
    fontFamily: F.display,
    fontSize: 33,
    lineHeight: 38,
    letterSpacing: -0.4,
  },
  titleCompact: { fontSize: 29, lineHeight: 34 },
  accent: { fontFamily: F.displayItalic, color: '#DDD9C9' },
  body: {
    marginTop: 8,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 14,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 15,
    paddingRight: 10,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: 'rgba(168,213,79,0.6)',
    backgroundColor: 'rgba(14,18,11,0.82)',
  },
  ctaText: { color: C.text, fontFamily: F.bold, fontSize: 13.5 },
  dots: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    pointerEvents: 'box-none',
  },
  dotHit: { paddingHorizontal: 3, paddingTop: 10, paddingBottom: 12 },
  dot: { height: 6, borderRadius: 3, backgroundColor: 'rgba(245,242,233,0.7)', overflow: 'hidden' },
  dotOn: { backgroundColor: C.leaf },
});
