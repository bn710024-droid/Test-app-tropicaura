import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableScale } from './PressableScale';
import type { Product, ProductFormat } from '../lib/data';
import { money, priceText } from '../lib/format';
import { C, F, R } from '../lib/theme';
import { tick } from '../lib/haptics';

type Props = {
  product: Product;
  /** Emballage choisi ; `null` : le produit initial (aucun emballage coché à l'ouverture). */
  selected: ProductFormat | null;
  /** `null` : retour au produit initial. */
  onSelect: (formatId: string | null) => void;
};

/**
 * « Choisissez votre format » : le produit initial d'abord, puis ses emballages actifs
 * (sachet, pot, carton…). Le prix d'un emballage est un prix GLOBAL par emballage ; la
 * quantité commandée est un nombre d'emballages. Un emballage sans prix fixé l'indique et
 * ne permet aucun total. Sans visuel publié, une icône tient lieu de case.
 */
export function FormatPicker({ product, selected, onSelect }: Props) {
  const formats = product.formats ?? [];
  if (formats.length === 0) return null;
  const scroll = formats.length >= 2;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Ionicons name="cube-outline" size={17} color={C.leaf} />
        <Text style={styles.title} accessibilityRole="header">
          Choisissez votre format
        </Text>
        <View style={styles.rule} />
      </View>

      <ScrollView
        horizontal
        scrollEnabled={scroll}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.row, !scroll && styles.rowFill]}
        accessibilityRole="radiogroup"
        accessibilityLabel={`Formats disponibles pour ${product.name}`}
      >
        {/* Le produit initial reste toujours accessible : il revient à l'aperçu et aux
            règles de vente configurés (kilo ou pièce). */}
        <PressableScale
          scaleTo={0.96}
          onPress={() => {
            if (!selected) return;
            tick();
            onSelect(null);
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: !selected }}
          aria-checked={!selected}
          accessibilityLabel={`Produit initial, ${product.unitLabel}, ${priceText(product)}`}
          style={[styles.card, scroll && styles.cardScroll, !selected && styles.cardOn]}
        >
          {!selected && (
            <View style={styles.check}>
              <Ionicons name="checkmark" size={13} color={C.onLeaf} />
            </View>
          )}
          <View style={styles.art}>
            <Ionicons
              name={product.unit === 'kg' ? 'scale-outline' : 'pricetag-outline'}
              size={30}
              color={C.textDim}
            />
          </View>
          <View style={styles.texts}>
            <Text style={styles.label} numberOfLines={1}>
              Produit initial
            </Text>
            <Text style={styles.detail} numberOfLines={1}>
              {product.unitLabel}
            </Text>
            <Text style={styles.price} numberOfLines={1}>
              {priceText(product)}
              {product.unit === 'kg' ? <Text style={styles.per}> / kg</Text> : null}
            </Text>
          </View>
        </PressableScale>

        {formats.map((f) => {
          const on = f.id === selected?.id;
          return (
            <PressableScale
              key={f.id}
              scaleTo={0.96}
              onPress={() => {
                if (on) return;
                tick();
                onSelect(f.id);
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              aria-checked={on}
              accessibilityLabel={`${f.label}${f.detail ? ` ${f.detail}` : ''}${
                f.grams ? `, contient ${f.grams} grammes` : ''
              }${f.price === null ? ', prix à compléter' : `, ${money(f.price, f.currency)} par ${f.noun[0]}`}`}
              style={[styles.card, scroll && styles.cardScroll, on && styles.cardOn]}
            >
              {on && (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={13} color={C.onLeaf} />
                </View>
              )}
              <View style={styles.art}>
                {f.image ? (
                  <Image
                    source={f.image}
                    style={styles.artImage}
                    contentFit="contain"
                    accessible={false}
                  />
                ) : (
                  // Visuel d'emballage pas encore fourni : la case s'affiche quand même.
                  <Ionicons name="cube-outline" size={30} color={C.textDim} />
                )}
              </View>
              <View style={styles.texts}>
                <Text style={styles.label} numberOfLines={1}>
                  {f.label}
                </Text>
                {!!f.detail && (
                  <Text style={styles.detail} numberOfLines={1}>
                    {f.detail}
                  </Text>
                )}
                {f.price === null ? (
                  <Text style={styles.missing} numberOfLines={1}>
                    Prix à compléter
                  </Text>
                ) : (
                  <Text style={styles.price} numberOfLines={1}>
                    {money(f.price, f.currency)}
                    <Text style={styles.per}>
                      {f.grams ? ` /\u00A0${f.grams}\u00A0g` : ` / ${f.noun[0]}`}
                    </Text>
                  </Text>
                )}
              </View>
            </PressableScale>
          );
        })}
      </ScrollView>

      {product.demo && (
        <View style={styles.demo}>
          <Ionicons name="information-circle-outline" size={14} color={C.textFaint} />
          <Text style={styles.demoText}>
            Formats et prix de démonstration : à remplacer par les données du catalogue réel.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { color: C.text, fontFamily: F.display, fontSize: 19, lineHeight: 24 },
  rule: { flex: 1, height: 1, backgroundColor: C.line },

  row: { gap: 10, flexGrow: 1 },
  rowFill: { width: '100%' },
  card: {
    flex: 1,
    minWidth: 150,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    paddingRight: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  cardScroll: { flex: 0, width: 190 },
  cardOn: {
    backgroundColor: 'rgba(168,213,79,0.10)',
    borderColor: C.leaf,
    borderWidth: 2,
    padding: 9,
    paddingRight: 11,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  art: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  artImage: { width: 46, height: 46 },
  texts: { flex: 1, minWidth: 0 },
  label: { color: C.text, fontFamily: F.bold, fontSize: 15, lineHeight: 20 },
  detail: { marginTop: 1, color: C.textDim, fontFamily: F.medium, fontSize: 12.5, lineHeight: 17 },
  price: {
    marginTop: 6,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  per: { color: C.textFaint, fontFamily: F.medium, fontSize: 10.5 },
  missing: { marginTop: 6, color: C.star, fontFamily: F.semi, fontSize: 12.5, lineHeight: 17 },

  demo: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  demoText: { flex: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 12, lineHeight: 17 },
});
