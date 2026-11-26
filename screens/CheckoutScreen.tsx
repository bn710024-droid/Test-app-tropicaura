import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BumpText, ErrorText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import { TextInput } from '../components/Input';
import { useNavigation } from '@react-navigation/native';
import Animated, { FadeInDown, FadeOut } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { AddressSheet } from '../components/AddressSheet';
import { Backdrop } from '../components/Backdrop';
import { PrimaryButton, RoundButton } from '../components/Buttons';
import { EmptyState } from '../components/EmptyState';
import { countryName, transportFee, transportZone } from '../lib/countries';
import { PAYMENTS } from '../lib/data';
import { euro, formatAddress, money, round2 } from '../lib/format';
import { isPhone } from '../lib/identity';
import { LocateError, locateCoords } from '../lib/locate';
import type { Nav } from '../lib/navigation';
import { OrderLocation, useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { success, tick, warn } from '../lib/haptics';

const NOTE_MAX = 140;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function Option({
  title,
  detail,
  price,
  icon,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
  /** Ligne de prix, sous le détail. */
  price?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={() => {
        tick();
        onPress();
      }}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[title, detail, price].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.option,
        selected && styles.optionOn,
        pressed && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.optionIcon, selected && { backgroundColor: C.leaf }]}>
        <Ionicons name={icon} size={18} color={selected ? C.onLeaf : C.textDim} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.optionTitle}>{title}</Text>
        <Text style={styles.optionDetail}>{detail}</Text>
        {!!price && <Text style={styles.optionPrice}>{price}</Text>}
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? C.leaf : C.textFaint}
      />
    </Pressable>
  );
}

export function CheckoutScreen() {
  const nav = useNavigation<Nav>();
  const { account, cartLines, subtotal, totalsByCurrency, address, contact, placeOrder, setTab, delivery } =
    useStore();
  const { top, bottom } = useFrame();
  const [transport, setTransport] = useState(true);
  // Sénégal : position partagée POUR LE LIVREUR, uniquement après accord explicite.
  // Elle est demandée AVANT le paiement ; un refus n'empêche pas de commander (repli
  // adresse + téléphone), mais la demande est faite.
  const [coords, setCoords] = useState<OrderLocation | null>(null);
  const [coordsNote, setCoordsNote] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locAsked, setLocAsked] = useState(false);
  const [paymentId, setPaymentId] = useState<string>(PAYMENTS[0].id);
  const [email, setEmail] = useState(contact.email || account?.email || '');
  const [phone, setPhone] = useState(contact.phone || account?.phone || '');
  const [note, setNote] = useState('');
  const [sheet, setSheet] = useState(false);
  // Commande pour soi ou pour un proche : « pour moi » demande la localisation avant le
  // paiement (Sénégal) ; « pour un proche » se contente de l'adresse, du numéro et d'un
  // lien de localisation facultatif.
  const [beneficiary, setBeneficiary] = useState<'moi' | 'proche' | null>(null);
  const [locLink, setLocLink] = useState('');
  const [errors, setErrors] = useState<{
    beneficiary?: string;
    address?: string;
    email?: string;
    phone?: string;
  }>({});
  // Validation en cours : un second appui ne peut pas créer une seconde commande.
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const alive = useRef(true);
  useEffect(
    () => () => {
      alive.current = false;
    },
    [],
  );
  const scrollRef = useRef<ScrollView>(null);
  const contactY = useRef(0);

  // Le transport est forfaitaire, selon le pays de destination. Sans transport, rien n'est ajouté.
  const fee = address ? transportFee(address.country) : null;
  const transportCost = transport ? (fee ?? 0) : 0;
  const total = round2(subtotal + transportCost);
  const destination = address ? countryName(address.country) : '';
  // Devises : on n'additionne jamais des montants de devises différentes, et aucune
  // conversion n'est inventée. Total incertain → paiement bloqué, l'équipe confirme.
  const currencies = totalsByCurrency.map((t) => t.currency);
  const singleCur =
    currencies.length === 1 ? currencies[0] : currencies.length === 0 ? 'EUR' : null;
  const mixed = singleCur === null || (singleCur !== 'EUR' && transportCost > 0);
  const payable = mixed ? 0 : singleCur === 'EUR' ? total : totalsByCurrency[0].amount;
  const totalText = mixed ? 'À confirmer' : money(payable, singleCur ?? undefined);
  // Sénégal : livraison à domicile par nos livreurs (moto), coordonnée par notre équipe.
  const senegal = address?.country === 'SN';
  // Europe : GP — seules les modalités réellement configurées sont présentées.
  const gp = address ? delivery.gp.find((g) => g.country === address.country) : undefined;
  const europe = address ? transportZone(address.country).id === 'eu' : false;

  const sharePosition = async () => {
    setLocating(true);
    setCoordsNote(null);
    try {
      const c = await locateCoords();
      setCoords({ ...c, at: Date.now() });
    } catch (e) {
      const reason = e instanceof LocateError ? e.reason : 'unavailable';
      setCoordsNote(
        (reason === 'denied'
          ? 'Autorisation refusée : aucune position n’est collectée. Précisez votre adresse et un point de repère dans les instructions ; le livreur vous appellera au numéro ci-dessous.'
          : 'Position indisponible pour le moment. Précisez votre adresse et un point de repère dans les instructions ; le livreur vous appellera.') +
          ' Appuyez de nouveau sur « Payer et confirmer » pour continuer.',
      );
    } finally {
      setLocating(false);
    }
  };

  const confirm = () => {
    if (sending.current) return;
    const mail = email.trim();
    const tel = phone.trim();
    const next: typeof errors = {};
    if (!beneficiary)
      next.beneficiary = 'Choisissez « Valider pour moi » ou « Valider pour un proche ».';
    if (!address) next.address = 'Ajoutez votre adresse pour continuer.';
    // Particuliers : le téléphone suffit pour la confirmation — l'e-mail est facultatif.
    if (mail && !EMAIL.test(mail))
      next.email = 'Cette adresse semble incomplète. Corrigez-la ou laissez le champ vide.';
    if (!tel) {
      next.phone =
        beneficiary === 'proche'
          ? 'Le numéro de votre proche est nécessaire pour la livraison.'
          : 'Un numéro est nécessaire pour la confirmation et la livraison.';
    } else if (!isPhone(tel)) {
      next.phone = 'Ce numéro semble incomplet. Ajoutez l’indicatif du pays.';
    }
    setErrors(next);
    if (next.beneficiary || next.address) {
      warn();
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (next.email || next.phone) {
      warn();
      scrollRef.current?.scrollTo({ y: Math.max(0, contactY.current - 12), animated: true });
      return;
    }
    // Total incertain (devises mélangées) : aucune commande n'est envoyée.
    if (mixed) {
      warn();
      return;
    }
    // Sénégal, commande pour soi : la localisation pour le livreur est demandée avant
    // d'envoyer l'argent. Premier appui : la demande d'autorisation s'ouvre ; le paiement
    // passe au suivant, avec la position si elle est accordée, sans elle si elle est refusée.
    if (beneficiary === 'moi' && senegal && transport && !coords && !locAsked) {
      setLocAsked(true);
      sharePosition();
      warn();
      return;
    }
    const payment = PAYMENTS.find((p) => p.id === paymentId) ?? PAYMENTS[0];
    sending.current = true;
    setBusy(true);
    // Aucun prestataire de paiement n'est branché : cette courte attente tient lieu de réponse.
    // L'écran de réussite ne s'ouvre qu'une fois la commande réellement enregistrée.
    setTimeout(() => {
      if (!alive.current) return;
      const order = placeOrder({
        transport,
        payment: payment.title,
        note: note.trim(),
        contact: { email: mail, phone: tel },
        location: beneficiary === 'moi' && senegal && transport ? coords : null,
        forSelf: beneficiary === 'moi',
        locationLink:
          beneficiary === 'proche' && locLink.trim() ? locLink.trim() : undefined,
      });
      success();
      nav.replace('Success', { orderId: order.id });
    }, 600);
  };

  const header = (
    <View style={[styles.header, { paddingTop: top + 4 }]}>
      <RoundButton icon="close" label="Fermer" onPress={() => nav.goBack()} />
      <Text style={styles.headerTitle} accessibilityRole="header">
        Votre commande
      </Text>
      <View style={{ width: 46 }} />
    </View>
  );

  if (cartLines.length === 0) {
    return (
      <View style={styles.root}>
        <Backdrop />
        {header}
        <EmptyState
          title="Rien à commander"
          body="Votre panier est vide. Ajoutez quelques produits avant de passer commande."
          cta="Parcourir l’étal"
          onPress={() => {
            setTab('home');
            nav.popToTop();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Backdrop />
      {header}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 24 }}
        >
          <Text style={styles.section} accessibilityRole="header">
            Pour qui est cette commande ?
          </Text>
          <View style={styles.beneRow} accessibilityRole="radiogroup">
            {(['moi', 'proche'] as const).map((b) => {
              const on = beneficiary === b;
              return (
                <Pressable
                  key={b}
                  onPress={() => {
                    tick();
                    setBeneficiary(b);
                    setErrors((e) => ({ ...e, beneficiary: undefined }));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={b === 'moi' ? 'Valider pour moi' : 'Valider pour un proche'}
                  style={({ pressed }) => [
                    styles.bene,
                    on && styles.beneOn,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Ionicons
                    name={b === 'moi' ? 'person-outline' : 'people-outline'}
                    size={18}
                    color={on ? C.leaf : C.textDim}
                  />
                  <Text style={[styles.beneText, on && styles.beneTextOn]} numberOfLines={2}>
                    {b === 'moi' ? 'Valider pour moi' : 'Valider pour un proche'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {!!errors.beneficiary && <ErrorText style={styles.error}>{errors.beneficiary}</ErrorText>}

          <Text style={[styles.section, { marginTop: 24 }]} accessibilityRole="header">
            {beneficiary === 'proche' ? 'Adresse de votre proche' : 'Adresse'}
          </Text>
          {address ? (
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel={`Adresse : ${address.name}, ${formatAddress(address)}. Modifier`}
              style={({ pressed }) => [styles.option, pressed && { opacity: 0.7 }]}
            >
              <View style={[styles.optionIcon, { backgroundColor: C.leafWash }]}>
                <Ionicons name="location-outline" size={18} color={C.leaf} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle} numberOfLines={1}>
                  {address.name}
                </Text>
                <Text style={styles.optionDetail} numberOfLines={3}>
                  {formatAddress(address)}
                </Text>
              </View>
              <Text style={styles.edit}>Modifier</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => setSheet(true)}
              accessibilityRole="button"
              accessibilityLabel="Ajouter votre adresse"
              style={({ pressed }) => [
                styles.option,
                styles.addAddress,
                !!errors.address && { borderColor: C.danger },
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.optionIcon, { backgroundColor: C.leafWash }]}>
                <Ionicons name="add" size={20} color={C.leaf} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.optionTitle}>Ajouter votre adresse</Text>
                <Text style={styles.optionDetail}>Pays, ville et rue, ou votre position</Text>
              </View>
            </Pressable>
          )}
          {!!errors.address && !address && (
            <ErrorText style={styles.error}>{errors.address}</ErrorText>
          )}
          {beneficiary === 'proche' && (
            <>
              <Text style={styles.fieldLabel}>
                Lien de localisation du proche<Text style={styles.optional}> · facultatif</Text>
              </Text>
              <TextInput
                value={locLink}
                onChangeText={setLocLink}
                placeholder="Lien Google Maps, ou laissez vide"
                placeholderTextColor={C.textFaint}
                style={styles.input}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={300}
                accessibilityLabel="Lien de localisation du proche"
              />
              <Text style={styles.sectionHint}>
                Pas de lien ? L’adresse et le numéro suffisent : notre équipe appellera votre
                proche pour la livraison.
              </Text>
            </>
          )}

          <Text style={styles.section} accessibilityRole="header">
            Transport
          </Text>
          <View accessibilityRole="radiogroup" style={styles.group}>
            <Option
              title="Avec transport"
              detail={
                senegal
                  ? `Livraison à domicile par nos livreurs (moto) · ${destination}`
                  : destination
                    ? `Nous expédions du Sénégal jusqu’à votre adresse · ${destination}`
                    : 'Nous expédions du Sénégal jusqu’à votre adresse'
              }
              price={fee == null ? 'Tarif selon le pays de destination' : `+ ${euro(fee)}`}
              icon="airplane-outline"
              selected={transport}
              onPress={() => setTransport(true)}
            />
            <Option
              title="Sans transport"
              detail="Vous organisez vous-même l’enlèvement et le transport"
              price="Aucun frais de transport"
              icon="cube-outline"
              selected={!transport}
              onPress={() => setTransport(false)}
            />
          </View>
          {!transport && (
            <Text style={styles.hint}>
              Votre commande sera mise à disposition à notre entrepôt au Sénégal. L’adresse et les
              horaires d’enlèvement vous sont communiqués à la validation de la commande.
            </Text>
          )}
          {transport && senegal && beneficiary === 'moi' && (
            <View style={styles.group}>
              <Text style={styles.snTitle}>Livraison à domicile · livreurs moto</Text>
              <Text style={styles.snText}>
                Notre équipe se coordonne avec le livreur : il vous appellera au numéro indiqué
                ci-dessous et suivra votre adresse. Si vous l’acceptez, partagez aussi votre
                position pour qu’il vous trouve plus facilement.
              </Text>
              {coords ? (
                <Text style={styles.snOk}>
                  Position enregistrée avec la commande{coords.accuracy ? ` (précision ± ${Math.round(coords.accuracy)} m)` : ''} :
                  elle sera transmise au livreur par notre équipe. Pas de suivi en temps réel pour
                  l’instant.
                </Text>
              ) : (
                <Pressable
                  onPress={sharePosition}
                  disabled={locating}
                  accessibilityRole="button"
                  accessibilityLabel="Partager ma position pour le livreur"
                  style={({ pressed }) => [styles.locateBtn, pressed && { opacity: 0.7 }]}
                >
                  <Ionicons name="navigate-outline" size={17} color={C.leaf} />
                  <Text style={styles.locateBtnText}>
                    {locating ? 'Localisation en cours…' : 'Partager ma position pour le livreur'}
                  </Text>
                </Pressable>
              )}
              {!!coordsNote && (
                <Text style={styles.snNote} accessibilityLiveRegion="polite">
                  {coordsNote}
                </Text>
              )}
            </View>
          )}
          {transport && gp && (
            <Text style={styles.hint}>
              Livraison via GP · {destination} : modalités convenues —{' '}
              {gp.options.map((o) => (o === 'domicile' ? 'à domicile' : 'jusqu’à l’aéroport')).join(' ou ')}.
              Tarifs et délais GP à confirmer par notre équipe ; le forfait affiché reste le
              barème de transport actuel.
            </Text>
          )}
          {transport && !gp && europe && (
            <Text style={styles.hint}>
              Livraison en Europe via GP : les modalités (à domicile ou jusqu’à l’aéroport) ne
              sont pas encore arrêtées. Notre équipe vous contactera pour les préciser ; aucun
              tarif ni délai GP n’est inclus ici.
            </Text>
          )}

          <View
            onLayout={(e) => {
              contactY.current = e.nativeEvent.layout.y;
            }}
          >
            <Text style={styles.section} accessibilityRole="header">
              Vos coordonnées
            </Text>
            <Text style={styles.sectionHint}>
              Pour la confirmation et le suivi de votre commande — le téléphone suffit.
            </Text>
            <Text style={styles.fieldLabel}>
              E-mail<Text style={styles.optional}> · facultatif</Text>
            </Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                setErrors((e) => ({ ...e, email: undefined }));
              }}
              placeholder="nom@exemple.com"
              placeholderTextColor={C.textFaint}
              style={[styles.input, !!errors.email && { borderColor: C.danger }]}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              returnKeyType="next"
              maxLength={80}
              accessibilityLabel="E-mail"
            />
            {!!errors.email && <ErrorText style={styles.error}>{errors.email}</ErrorText>}
            <Text style={styles.fieldLabel}>
              {beneficiary === 'proche' ? 'Numéro du proche (livraison)' : 'Téléphone ou WhatsApp'}
            </Text>
            <TextInput
              value={phone}
              onChangeText={(t) => {
                setPhone(t);
                setErrors((e) => ({ ...e, phone: undefined }));
              }}
              placeholder="Avec l’indicatif du pays"
              placeholderTextColor={C.textFaint}
              style={[styles.input, !!errors.phone && { borderColor: C.danger }]}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              returnKeyType="done"
              maxLength={24}
              accessibilityLabel={
                beneficiary === 'proche' ? 'Numéro du proche (livraison)' : 'Téléphone ou WhatsApp'
              }
            />
            {!!errors.phone && <ErrorText style={styles.error}>{errors.phone}</ErrorText>}
          </View>

          <Text style={styles.section} accessibilityRole="header">
            Paiement
          </Text>
          <Text style={styles.sectionHint}>
            Vous réglez maintenant, à la confirmation de la commande.
          </Text>
          <View accessibilityRole="radiogroup" style={[styles.group, { marginTop: 12 }]}>
            {PAYMENTS.map((p) => (
              <Option
                key={p.id}
                title={p.title}
                detail={p.detail}
                icon={p.icon}
                selected={paymentId === p.id}
                onPress={() => setPaymentId(p.id)}
              />
            ))}
          </View>

          <View style={styles.noteHead}>
            <Text
              style={[styles.section, { marginTop: 0, marginBottom: 0 }]}
              accessibilityRole="header"
            >
              {transport ? 'Un mot pour le livreur' : 'Un mot pour notre équipe'}
            </Text>
            <Text style={styles.counter}>
              {note.length}/{NOTE_MAX}
            </Text>
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={
              transport
                ? 'Code d’entrée, étage, interphone…'
                : 'Nom de votre transporteur, date d’enlèvement souhaitée…'
            }
            placeholderTextColor={C.textFaint}
            style={styles.note}
            multiline
            maxLength={NOTE_MAX}
            textAlignVertical="top"
            accessibilityLabel={
              transport
                ? 'Instructions pour le livreur, facultatif'
                : 'Message pour notre équipe, facultatif'
            }
          />

          <View style={styles.summary}>
            {totalsByCurrency.length > 0 ? (
              totalsByCurrency.map((t) => (
                <View key={t.currency} style={styles.sumRow}>
                  <Text style={styles.sumLabel} numberOfLines={1}>
                    Produits
                    {totalsByCurrency.length > 1 ? ` · ${t.currency}` : ''}
                  </Text>
                  <Text style={styles.sumValue}>{money(t.amount, t.currency)}</Text>
                </View>
              ))
            ) : (
              <View style={styles.sumRow}>
                <Text style={styles.sumLabel}>
                  Produits · {cartLines.length} article{cartLines.length > 1 ? 's' : ''}
                </Text>
                <Text style={styles.sumValue}>{euro(subtotal)}</Text>
              </View>
            )}
            {transport && (
              <Animated.View
                entering={FadeInDown.duration(200)}
                exiting={FadeOut.duration(120)}
                style={styles.sumRow}
              >
                <Text style={styles.sumLabel} numberOfLines={1}>
                  Transport{destination ? ` · ${destination}` : ''}
                </Text>
                <Text style={[styles.sumValue, fee == null && styles.sumMuted]}>
                  {fee == null ? 'Selon le pays' : euro(fee)}
                </Text>
              </Animated.View>
            )}
            <View style={styles.divider} />
            <View style={styles.sumRow}>
              <Text style={styles.totalLabel}>
                {transport ? 'Total à payer' : 'Total sans transport'}
              </Text>
              <BumpText value={payable} style={styles.totalValue}>
                {totalText}
              </BumpText>
            </View>
            {mixed && (
              <Text style={styles.sumNote}>
                Plusieurs devises dans cette commande : le total ne peut pas être calculé ici et
                le paiement est bloqué. Notre équipe confirme le montant avec vous.
              </Text>
            )}
            {!transport && (
              <Text style={styles.sumNote}>
                Prix sans transport : vous organisez vous-même l’enlèvement et l’acheminement.
              </Text>
            )}
            {transport && fee == null && (
              <Text style={styles.sumNote}>
                Ajoutez votre adresse : le transport s’ajoutera à ce total.
              </Text>
            )}
          </View>

          <View style={styles.demo}>
            <Ionicons name="information-circle-outline" size={17} color={C.textDim} />
            <Text style={styles.demoText}>
              Application de démonstration : aucun paiement n’est prélevé, aucun message n’est
              réellement envoyé et aucune commande n’est transmise.
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: bottom + 4 }]}>
          <PrimaryButton
            label="Payer et confirmer"
            trailing={totalText}
            onPress={confirm}
            loading={busy}
            loadingLabel="Paiement simulé…"
          />
        </View>
      </KeyboardAvoidingView>
      <AddressSheet visible={sheet} onClose={() => setSheet(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitle: { color: C.text, fontFamily: F.display, fontSize: 20 },
  section: {
    marginTop: 26,
    marginBottom: 12,
    color: C.text,
    fontFamily: F.display,
    fontSize: 19,
    lineHeight: 24,
  },
  sectionHint: {
    marginTop: -6,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  group: { gap: 10 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 66,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  optionOn: { borderColor: 'rgba(168,213,79,0.5)', backgroundColor: C.leafWash },
  addAddress: { borderStyle: 'dashed', borderColor: C.lineStrong },
  optionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
  },
  optionTitle: { color: C.text, fontFamily: F.bold, fontSize: 15, lineHeight: 20 },
  optionDetail: {
    marginTop: 1,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  optionPrice: {
    marginTop: 5,
    color: C.text,
    fontFamily: F.heavy,
    fontSize: 14,
    lineHeight: 19,
    fontVariant: ['tabular-nums'],
  },
  edit: { color: C.leaf, fontFamily: F.bold, fontSize: 14, paddingHorizontal: 4 },
  hint: {
    marginTop: 10,
    paddingHorizontal: 4,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 20,
  },
  beneRow: { flexDirection: 'row', gap: 10 },
  bene: {
    flex: 1,
    minHeight: 68,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: 8,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
  },
  beneOn: { borderColor: C.leaf, backgroundColor: C.leafWash },
  beneText: { color: C.textDim, fontFamily: F.bold, fontSize: 13.5, textAlign: 'center' },
  beneTextOn: { color: C.leaf, fontFamily: F.heavy },
  snTitle: { color: C.text, fontFamily: F.bold, fontSize: 14.5, lineHeight: 20 },
  snText: {
    marginTop: 6,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13,
    lineHeight: 19,
  },
  snOk: {
    marginTop: 10,
    color: C.leaf,
    fontFamily: F.semi,
    fontSize: 13,
    lineHeight: 19,
  },
  snNote: {
    marginTop: 10,
    color: C.star,
    fontFamily: F.semi,
    fontSize: 12.5,
    lineHeight: 18,
  },
  locateBtn: {
    alignSelf: 'flex-start',
    marginTop: 12,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 15,
    borderRadius: R.pill,
    borderWidth: 1,
    borderColor: 'rgba(168,213,79,0.6)',
    backgroundColor: C.leafWash,
  },
  locateBtnText: { color: C.text, fontFamily: F.bold, fontSize: 13.5 },
  error: {
    marginTop: 8,
    paddingHorizontal: 4,
    color: C.danger,
    fontFamily: F.semi,
    fontSize: 13.5,
    lineHeight: 19,
  },

  fieldLabel: {
    marginTop: 14,
    marginBottom: 7,
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 13,
  },
  optional: { color: C.textFaint, fontFamily: F.medium },
  input: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
  },

  noteHead: {
    marginTop: 26,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  counter: {
    color: C.textFaint,
    fontFamily: F.semi,
    fontSize: 12.5,
    fontVariant: ['tabular-nums'],
  },
  note: {
    minHeight: 92,
    padding: 16,
    paddingTop: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.lineStrong,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 16,
    lineHeight: 22,
  },

  summary: {
    marginTop: 26,
    padding: 18,
    gap: 12,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  sumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 12,
  },
  sumLabel: { flexShrink: 1, color: C.textDim, fontFamily: F.semi, fontSize: 15 },
  sumValue: { color: C.text, fontFamily: F.bold, fontSize: 15, fontVariant: ['tabular-nums'] },
  sumMuted: { color: C.textDim },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 2 },
  totalLabel: { color: C.text, fontFamily: F.display, fontSize: 20 },
  totalValue: { color: C.text, fontFamily: F.heavy, fontSize: 24, fontVariant: ['tabular-nums'] },
  sumNote: { color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },

  demo: { flexDirection: 'row', gap: 9, marginTop: 16, paddingHorizontal: 4 },
  demoText: { flex: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },

  bar: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: 'rgba(11,14,9,0.92)',
  },
});
