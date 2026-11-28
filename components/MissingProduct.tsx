import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { PrimaryButton } from './Buttons';
import { TextInput } from './Input';
import { ErrorText } from './Motion';
import { KeepsOwnSwipes } from './PageSwipe';
import { success } from '../lib/haptics';
import { useStore } from '../lib/store';
import { C, F, R } from '../lib/theme';

/**
 * Produit introuvable : la recherche ne donne rien dans tout le catalogue. On demande au client
 * quel produit il recherche — sa recherche est déjà écrite — et sa demande part vers l'équipe,
 * qui reviendra vers lui. Les textes viennent de la tour de contrôle ; si elle ne les fournit
 * pas, ou si l'équipe a désactivé ce message, rien ne s'affiche.
 */
export function MissingProduct({ query }: { query: string }) {
  const { productRequest, requestProduct } = useStore();
  const [text, setText] = useState(query);
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle');

  // La recherche fait foi : à chaque nouvelle recherche, le champ la reprend et l'on repart de
  // zéro. Le client peut préciser sa demande dans le champ tant que la recherche ne change pas.
  useEffect(() => {
    setText(query);
    setState('idle');
  }, [query]);

  if (!productRequest) return null;
  const product = text.trim().replace(/\s+/g, ' ');
  const ready = product.length >= 2;

  const send = async () => {
    if (!ready || state === 'sending') return;
    setState('sending');
    const result = await requestProduct(product);
    if (result === 'sent') success();
    setState(result === 'sent' ? 'sent' : 'failed');
  };

  if (state === 'sent') {
    return (
      <View style={[styles.card, styles.done]} accessibilityLiveRegion="polite">
        <View style={styles.check}>
          <Ionicons name="checkmark" size={20} color={C.onLeaf} />
        </View>
        <Text style={styles.thanks}>{productRequest.thanks}</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        {productRequest.title}
      </Text>
      <Text style={styles.body}>{productRequest.body}</Text>
      <KeepsOwnSwipes>
        <TextInput
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (state === 'failed') setState('idle');
          }}
          placeholder={productRequest.placeholder}
          placeholderTextColor={C.textFaint}
          maxLength={80}
          returnKeyType="send"
          onSubmitEditing={send}
          accessibilityLabel={productRequest.placeholder || productRequest.title}
          style={styles.input}
        />
      </KeepsOwnSwipes>
      {state === 'failed' && (
        <ErrorText style={styles.error}>
          Votre demande n’est pas partie. Vérifiez votre connexion, puis réessayez.
        </ErrorText>
      )}
      <PrimaryButton
        label={productRequest.button}
        onPress={send}
        disabled={!ready}
        loading={state === 'sending'}
        loadingLabel="Envoi…"
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 26,
    marginHorizontal: 20,
    padding: 18,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  done: { alignItems: 'center', borderColor: 'rgba(168,213,79,0.4)', backgroundColor: C.leafWash },
  check: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.leaf,
  },
  thanks: {
    marginTop: 12,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  title: { color: C.text, fontFamily: F.display, fontSize: 20, lineHeight: 26 },
  body: { marginTop: 8, color: C.textDim, fontFamily: F.medium, fontSize: 14.5, lineHeight: 21 },
  input: {
    marginTop: 14,
    height: 50,
    paddingHorizontal: 16,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: 'rgba(0,0,0,0.25)',
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
  },
  error: { marginTop: 10 },
  button: { marginTop: 14 },
});
