import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ErrorText } from '../components/Motion';
import { Pressable } from '../components/Tap';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Backdrop } from '../components/Backdrop';
import { GhostButton, PrimaryButton, RoundButton } from '../components/Buttons';
import { Field } from '../components/Field';
import { TextInput } from '../components/Input';
import { WelcomeStory } from '../components/WelcomeStory';
import { COUNTRIES, countryName } from '../lib/countries';
import { normalize } from '../lib/format';
import { isEmail, isPhone } from '../lib/identity';
import { ACTIVITY_LABEL, AccountType, Activity, useStore } from '../lib/store';
import { C, F, PAD, R } from '../lib/theme';
import { useFrame } from '../lib/useFrame';
import { success, tick } from '../lib/haptics';

type Mode = 'welcome' | 'signup' | 'signin';
type Errors = Partial<
  Record<'name' | 'identifier' | 'phone' | 'email' | 'whatsapp' | 'country' | 'form', string>
>;

/** Étapes de l'inscription : 1 type, 2 informations, 3 connexion, 4 recommandation. */
type Step = 1 | 2 | 3 | 4;
type Method = 'tel' | 'email';
const STEP_TITLE: Record<Step, string> = {
  1: 'Vous êtes',
  2: 'Vos informations',
  3: 'Choix de connexion',
  4: 'Recommandation',
};

/** Barre de progression : un segment par étape, rempli au fur et à mesure. */
function Progress({ step }: { step: Step }) {
  return (
    <View
      style={styles.progressWrap}
      accessible
      accessibilityLabel={`Étape ${step} sur 4 : ${STEP_TITLE[step]}`}
    >
      <View style={styles.progressRow}>
        {([1, 2, 3, 4] as Step[]).map((s) => (
          <View key={s} style={[styles.progressSeg, s <= step && styles.progressSegOn]} />
        ))}
      </View>
      <Text style={styles.progressText}>
        Étape {step} sur 4
      </Text>
    </View>
  );
}

const ACTIVITIES: Activity[] = ['grossiste', 'importateur', 'autre'];

function TypeCard({
  title,
  detail,
  icon,
  selected,
  onPress,
}: {
  title: string;
  detail: string;
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
      accessibilityLabel={`${title}. ${detail}`}
      style={({ pressed }) => [styles.type, selected && styles.typeOn, pressed && { opacity: 0.7 }]}
    >
      <View style={[styles.typeIcon, selected && { backgroundColor: C.leaf }]}>
        <Ionicons name={icon} size={19} color={selected ? C.onLeaf : C.textDim} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.typeTitle}>{title}</Text>
        <Text style={styles.typeDetail}>{detail}</Text>
      </View>
      <Ionicons
        name={selected ? 'radio-button-on' : 'radio-button-off'}
        size={22}
        color={selected ? C.leaf : C.textFaint}
      />
    </Pressable>
  );
}

/** Inscription et connexion : la porte d'entrée de l'application. */
export function AuthScreen() {
  const { signUp, signIn } = useStore();
  const { top, bottom, width, height } = useFrame();
  // Écran peu haut : l'histoire se resserre pour que les deux boutons restent visibles.
  const compact = height < 720;
  const [mode, setMode] = useState<Mode>('welcome');
  const [type, setType] = useState<AccountType>('particulier');
  const [activity, setActivity] = useState<Activity>('grossiste');
  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [company, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  // Pays obligatoire à l'inscription (particulier comme professionnel) : il pilote les
  // offres et les produits visibles. La localisation, elle, n'est demandée qu'à la commande.
  const [country, setCountry] = useState('');
  const [picking, setPicking] = useState(false);
  const [countryQuery, setCountryQuery] = useState('');
  // Parcours d'inscription par étapes : le choix du type ouvre directement « Vos informations ».
  const [step, setStep] = useState<Step>(1);
  const [method, setMethod] = useState<Method>('tel');
  const [methodNote, setMethodNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const go = (next: Mode) => {
    setErrors({});
    setMode(next);
    setStep(1);
    setMethod('tel');
    setMethodNote(null);
  };

  /** Valide l'étape « Vos informations » (nom, téléphone, pays obligatoires ; e-mail facultatif). */
  const validateInfo = () => {
    const next: Errors = {};
    if (name.trim().length < 2) next.name = 'Indiquez votre nom.';
    if (!isPhone(phone))
      next.phone = 'Indiquez un numéro avec l’indicatif du pays, par exemple +221 77 123 45 67.';
    if (!country) next.country = 'Choisissez votre pays : les offres et produits en dépendent.';
    if (email.trim() && !isEmail(email))
      next.email = 'Cette adresse semble incomplète. Corrigez-la ou laissez le champ vide.';
    if (type === 'pro' && whatsapp.trim() && !isPhone(whatsapp))
      next.whatsapp = 'Ce numéro semble incomplet. Corrigez-le ou laissez le champ vide.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const next = () => {
    if (step === 1) {
      setErrors({});
      setStep(2);
      return;
    }
    if (step === 2) {
      if (validateInfo()) setStep(3);
      return;
    }
    if (step === 3) {
      if (method === 'email' && !isEmail(email.trim())) {
        setErrors({ email: 'Indiquez une adresse e-mail valide pour cette connexion.' });
        return;
      }
      setErrors({});
      setStep(4);
      return;
    }
    create();
  };
  const edit = (setter: (t: string) => void) => (t: string) => {
    setter(t);
    setErrors({});
  };

  const create = () => {
    // Garde-fou : les informations sont validées à l'étape 2, la connexion à l'étape 3.
    if (!validateInfo()) {
      setStep(2);
      return;
    }
    if (method === 'email' && !isEmail(email.trim())) {
      setErrors({ email: 'Indiquez une adresse e-mail valide pour cette connexion.' });
      setStep(3);
      return;
    }
    const pro = type === 'pro';
    const result = signUp({
      type,
      name,
      email: email.trim(),
      phone,
      whatsapp: pro ? whatsapp : '',
      company: pro ? company : '',
      activity: pro ? activity : null,
      country,
    });
    if (!result.ok) return setErrors({ form: result.error });
    success();
  };

  const shareWhatsapp = () => {
    const text =
      'Découvre Primeur : fruits et légumes du Sénégal, séchés et transformés, livrés à domicile.';
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(text)}`).catch(() => {});
  };

  const connect = async () => {
    if (busy) return;
    if (!isEmail(identifier) && !isPhone(identifier)) {
      return setErrors({
        identifier: 'Indiquez l’adresse e-mail ou le numéro de téléphone de votre compte.',
      });
    }
    setBusy(true);
    const result = await signIn(identifier);
    setBusy(false);
    if (!result.ok) setErrors({ form: result.error });
    else success();
  };

  if (mode === 'welcome') {
    return (
      <View style={styles.root}>
        <Backdrop />
        {/* L'histoire défile si l'écran est très petit ; les deux accès restent fixes en bas. */}
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.welcome, { paddingTop: top + (compact ? 6 : 16) }]}
        >
          <WelcomeStory width={width} compact={compact} tall={height >= 800} />
        </ScrollView>
        <Animated.View
          entering={FadeInDown.delay(150).duration(420)}
          style={[styles.actions, { paddingBottom: bottom + 12 }]}
        >
          <PrimaryButton label="Créer mon compte" onPress={() => go('signup')} />
          <GhostButton label="J’ai déjà un compte" onPress={() => go('signin')} />
        </Animated.View>
      </View>
    );
  }

  const signup = mode === 'signup';

  return (
    <View style={styles.root}>
      <Backdrop />
      <View style={[styles.header, { paddingTop: top + 4 }]}>
        <RoundButton
          icon="chevron-back"
          label="Retour"
          onPress={() => (signup && step > 1 ? setStep((step - 1) as Step) : go('welcome'))}
        />
        <Text style={styles.headerTitle} accessibilityRole="header">
          {signup ? STEP_TITLE[step] : 'Me connecter'}
        </Text>
        <View style={{ width: 46 }} />
      </View>
      {signup && <Progress step={step} />}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: PAD, paddingBottom: 24 }}
        >
          {signup ? (
            <Animated.View key={step} entering={FadeInDown.duration(380)}>
              {step === 1 && (
                <>
              <Text style={styles.section}>Vous êtes</Text>
              <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
                <TypeCard
                  title="Particulier"
                  detail="Vous commandez pour vous ou vos proches, au prix particulier."
                  icon="person-outline"
                  selected={type === 'particulier'}
                  onPress={() => {
                    setType('particulier');
                    setErrors({});
                    setStep(2);
                  }}
                />
                <TypeCard
                  title="Professionnel"
                  detail="Grossiste, importateur… Achat en gros par avion ou par bateau, prix EXW ou FOB."
                  icon="briefcase-outline"
                  selected={type === 'pro'}
                  onPress={() => {
                    setType('pro');
                    setErrors({});
                    setStep(2);
                  }}
                />
              </View>
                </>
              )}

              {step === 2 && (
                <>
              {type === 'pro' && (
                <>
                  <Text style={styles.section}>Votre activité</Text>
                  <View accessibilityRole="radiogroup" style={styles.chips}>
                    {ACTIVITIES.map((a) => {
                      const on = a === activity;
                      return (
                        <Pressable
                          key={a}
                          onPress={() => {
                            tick();
                            setActivity(a);
                          }}
                          accessibilityRole="radio"
                          accessibilityState={{ selected: on }}
                          style={({ pressed }) => [
                            styles.chip,
                            on && styles.chipOn,
                            pressed && { opacity: 0.7 },
                          ]}
                        >
                          <Text style={[styles.chipText, on && styles.chipTextOn]}>
                            {ACTIVITY_LABEL[a]}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}

              <Text style={styles.section}>
                {type === 'pro' ? 'Pour vous recontacter' : 'Vos informations'}
              </Text>
              <Field
                label="Votre nom"
                value={name}
                onChangeText={edit(setName)}
                error={errors.name}
                autoComplete="name"
                textContentType="name"
                autoCapitalize="words"
                maxLength={60}
                containerStyle={{ marginTop: -14 }}
              />
              {type === 'pro' ? (
                <>
                  <Field
                    label="Société"
                    optional
                    value={company}
                    onChangeText={edit(setCompany)}
                    autoCapitalize="words"
                    maxLength={60}
                  />
                  <Field
                    label="Téléphone"
                    value={phone}
                    onChangeText={edit(setPhone)}
                    error={errors.phone}
                    placeholder="+221 77 123 45 67"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    maxLength={24}
                  />
                  <Field
                    label="WhatsApp"
                    optional
                    value={whatsapp}
                    onChangeText={edit(setWhatsapp)}
                    error={errors.whatsapp}
                    placeholder="Si différent du téléphone"
                    keyboardType="phone-pad"
                    maxLength={24}
                    returnKeyType="done"
                  />
                </>
              ) : (
                <>
                  <Field
                    label="Numéro de téléphone"
                    value={phone}
                    onChangeText={edit(setPhone)}
                    error={errors.phone}
                    hint="Il vous servira à retrouver votre compte et à être rappelé."
                    placeholder="+221 77 123 45 67"
                    keyboardType="phone-pad"
                    autoComplete="tel"
                    textContentType="telephoneNumber"
                    maxLength={24}
                  />
                  <Field
                    label="E-mail"
                    optional
                    value={email}
                    onChangeText={edit(setEmail)}
                    error={errors.email}
                    placeholder="nom@exemple.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoComplete="email"
                    textContentType="emailAddress"
                    maxLength={80}
                  />
                </>
              )}

              {/* Pays obligatoire : particulier comme professionnel. */}
              <Text style={styles.countryLabel}>Pays</Text>
              <Pressable
                onPress={() => {
                  tick();
                  setPicking((p) => !p);
                }}
                accessibilityRole="button"
                accessibilityLabel={
                  country ? `Pays : ${countryName(country)}. Modifier` : 'Choisir votre pays'
                }
                style={({ pressed }) => [styles.countryPicker, pressed && { opacity: 0.7 }]}
              >
                <Ionicons name="globe-outline" size={18} color={C.textDim} />
                <Text style={[styles.countryValue, !country && styles.countryPlaceholder]} numberOfLines={1}>
                  {country ? countryName(country) : 'Choisir votre pays'}
                </Text>
                <Ionicons
                  name={picking ? 'chevron-up' : 'chevron-down'}
                  size={16}
                  color={C.textFaint}
                />
              </Pressable>
              {!!errors.country && <ErrorText style={styles.countryError}>{errors.country}</ErrorText>}
              {picking && (
                <View style={styles.countryBox}>
                  <TextInput
                    focusRing={false}
                    value={countryQuery}
                    onChangeText={setCountryQuery}
                    placeholder="Rechercher un pays"
                    placeholderTextColor={C.textFaint}
                    style={styles.countrySearch}
                    autoCorrect={false}
                    autoCapitalize="none"
                    returnKeyType="done"
                    accessibilityLabel="Rechercher un pays"
                  />
                  <ScrollView
                    style={{ maxHeight: 240 }}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {COUNTRIES.filter((c) => normalize(c.name).includes(normalize(countryQuery))).map(
                      (c) => {
                        const on = c.code === country;
                        return (
                          <Pressable
                            key={c.code}
                            onPress={() => {
                              tick();
                              setCountry(c.code);
                              setCountryQuery('');
                              setPicking(false);
                              setErrors((e) => ({ ...e, country: undefined }));
                            }}
                            accessibilityRole="radio"
                            accessibilityState={{ selected: on }}
                            accessibilityLabel={c.name}
                            style={({ pressed }) => [styles.countryRow, pressed && { opacity: 0.6 }]}
                          >
                            <Text style={[styles.countryName, on && styles.countryNameOn]}>{c.name}</Text>
                            {on && <Ionicons name="checkmark" size={18} color={C.leaf} />}
                          </Pressable>
                        );
                      },
                    )}
                  </ScrollView>
                </View>
              )}
                </>
              )}

              {step === 3 && (
                <>
                  <Text style={styles.section}>Choix de connexion</Text>
                  <Text style={styles.lead}>
                    Comment retrouverez-vous votre compte ? Aucun SMS payant : la connexion se
                    fait avec votre numéro ou votre e-mail. Apple et Google s’ajouteront dès que
                    ces services seront configurés.
                  </Text>
                  <View accessibilityRole="radiogroup" style={{ gap: 10 }}>
                    <TypeCard
                      title="Numéro de téléphone"
                      detail={`Votre compte est retrouvé avec le ${phone}`}
                      icon="call-outline"
                      selected={method === 'tel'}
                      onPress={() => {
                        tick();
                        setMethod('tel');
                      }}
                    />
                    <TypeCard
                      title="Adresse e-mail (Gmail)"
                      detail="Avec votre e-mail — aucun frais de SMS."
                      icon="mail-outline"
                      selected={method === 'email'}
                      onPress={() => {
                        tick();
                        setMethod('email');
                      }}
                    />
                    <Pressable
                      onPress={() => {
                        tick();
                        setMethodNote(
                          'La connexion Apple est préparée : elle s’activera dès que le service sera configuré, sans frais de SMS.',
                        );
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: false }}
                      accessibilityLabel="Compte Apple — bientôt, service à configurer"
                      style={({ pressed }) => [
                        styles.type,
                        styles.typeSoon,
                        pressed && { opacity: 0.7 },
                      ]}
                    >
                      <View style={styles.typeIcon}>
                        <Ionicons name="logo-apple" size={19} color={C.textDim} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.typeTitle}>Compte Apple</Text>
                        <Text style={styles.typeDetail}>
                          Préparé, non connecté : s’activera dès que le service Apple sera configuré.
                        </Text>
                      </View>
                      <View style={styles.soonBadge}>
                        <Text style={styles.soonBadgeText}>Bientôt</Text>
                      </View>
                    </Pressable>
                  </View>
                  {method === 'email' && (
                    <Field
                      label="Votre e-mail"
                      value={email}
                      onChangeText={edit(setEmail)}
                      error={errors.email}
                      placeholder="nom@exemple.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoCorrect={false}
                      autoComplete="email"
                      textContentType="emailAddress"
                      maxLength={80}
                    />
                  )}
                  {!!methodNote && <Text style={styles.methodNote}>{methodNote}</Text>}
                </>
              )}

              {step === 4 && (
                <>
                  <Text style={styles.section}>Recommandez Primeur</Text>
                  <Text style={styles.lead}>
                    Dernière étape, facultative : faites découvrir Primeur à vos proches sur
                    WhatsApp — gratuit, aucun SMS.
                  </Text>
                  <Pressable
                    onPress={shareWhatsapp}
                    accessibilityRole="button"
                    accessibilityLabel="Partager Primeur sur WhatsApp"
                    style={({ pressed }) => [styles.shareBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Ionicons name="logo-whatsapp" size={18} color={C.onLeaf} />
                    <Text style={styles.shareText}>Partager sur WhatsApp</Text>
                  </Pressable>
                </>
              )}
            </Animated.View>
          ) : (
            <>
              <Text style={styles.lead}>
                Retrouvez vos favoris, votre panier et vos commandes avec l’identifiant de votre
                compte.
              </Text>
              <Field
                label="E-mail ou numéro de téléphone"
                value={identifier}
                onChangeText={edit(setIdentifier)}
                error={errors.identifier}
                placeholder="nom@exemple.com ou +221 77 123 45 67"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={80}
                returnKeyType="done"
                onSubmitEditing={connect}
              />
              <View style={styles.soonRow}>
                <View style={styles.soonChip}>
                  <Ionicons name="logo-apple" size={13} color={C.textFaint} />
                  <Text style={styles.soonChipText}>Apple — bientôt</Text>
                </View>
                <View style={styles.soonChip}>
                  <Ionicons name="logo-google" size={13} color={C.textFaint} />
                  <Text style={styles.soonChipText}>Google — bientôt</Text>
                </View>
              </View>
              <Text style={styles.methodNote}>
                Numéro de téléphone ou e-mail : aucun SMS payant. Les connexions Apple et Google
                s’ajouteront ici dès que ces services seront configurés.
              </Text>
            </>
          )}

          {!!errors.form && <ErrorText style={styles.formError}>{errors.form}</ErrorText>}

          <View style={styles.notice}>
            <Ionicons name="phone-portrait-outline" size={17} color={C.textDim} />
            <Text style={styles.noticeText}>
              Prototype sans serveur : votre compte et vos données sont enregistrés sur cet appareil
              uniquement, sans mot de passe ni code de vérification pour l’instant.
            </Text>
          </View>

          <Pressable
            onPress={() => go(signup ? 'signin' : 'signup')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.switch, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.switchText}>
              {signup ? 'J’ai déjà un compte : me connecter' : 'Pas encore de compte : m’inscrire'}
            </Text>
          </Pressable>
        </ScrollView>

        <View style={[styles.bar, { paddingBottom: bottom + 4 }]}>
          <PrimaryButton
            label={signup ? (step < 4 ? 'Continuer' : 'Entrer dans l’application') : 'Me connecter'}
            onPress={signup ? next : connect}
            disabled={busy}
          />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  progressWrap: { paddingHorizontal: PAD, paddingTop: 4, paddingBottom: 2 },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressSeg: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  progressSegOn: { backgroundColor: C.leaf },
  progressText: {
    marginTop: 7,
    color: C.textFaint,
    fontFamily: F.semi,
    fontSize: 12,
  },
  typeSoon: { opacity: 0.75 },
  soonBadge: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: R.pill,
    backgroundColor: C.surfaceStrong,
  },
  soonBadgeText: { color: C.textDim, fontFamily: F.bold, fontSize: 11 },
  methodNote: {
    marginTop: 12,
    color: C.textFaint,
    fontFamily: F.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },
  shareBtn: {
    alignSelf: 'flex-start',
    marginTop: 6,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    borderRadius: R.pill,
    backgroundColor: C.leaf,
  },
  shareText: { color: C.onLeaf, fontFamily: F.heavy, fontSize: 14.5 },
  soonRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  soonChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 30,
    paddingHorizontal: 12,
    borderRadius: 15,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  soonChipText: { color: C.textFaint, fontFamily: F.bold, fontSize: 12 },
  countryLabel: {
    marginTop: 14,
    marginBottom: 7,
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 13,
  },
  countryPicker: {
    height: 52,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  countryValue: { flex: 1, color: C.text, fontFamily: F.semi, fontSize: 16 },
  countryPlaceholder: { color: C.textFaint },
  countryError: { marginTop: 8, paddingHorizontal: 4 },
  countryBox: {
    marginTop: 8,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.lineStrong,
    backgroundColor: C.raised,
    overflow: 'hidden',
  },
  countrySearch: {
    height: 46,
    paddingHorizontal: 14,
    color: C.text,
    fontFamily: F.semi,
    fontSize: 15,
    borderBottomWidth: 1,
    borderBottomColor: C.line,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null),
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  countryName: { color: C.textDim, fontFamily: F.semi, fontSize: 15 },
  countryNameOn: { color: C.text, fontFamily: F.bold },
  welcome: { flexGrow: 1, justifyContent: 'center', paddingBottom: 14 },
  actions: { gap: 10, paddingHorizontal: PAD, paddingTop: 6 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  headerTitle: { color: C.text, fontFamily: F.display, fontSize: 20 },
  section: {
    marginTop: 24,
    marginBottom: 12,
    color: C.text,
    fontFamily: F.display,
    fontSize: 19,
    lineHeight: 24,
  },
  lead: {
    marginTop: 14,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 15,
    lineHeight: 23,
  },
  type: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: R.lg,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  typeOn: { borderColor: 'rgba(168,213,79,0.5)', backgroundColor: C.leafWash },
  typeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceStrong,
  },
  typeTitle: { color: C.text, fontFamily: F.bold, fontSize: 15.5, lineHeight: 21 },
  typeDetail: {
    marginTop: 2,
    color: C.textDim,
    fontFamily: F.medium,
    fontSize: 13.5,
    lineHeight: 19,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.leafWash, borderColor: 'rgba(168,213,79,0.5)' },
  chipText: { color: C.textDim, fontFamily: F.semi, fontSize: 14 },
  chipTextOn: { color: C.text, fontFamily: F.bold },
  formError: {
    marginTop: 16,
    color: C.danger,
    fontFamily: F.semi,
    fontSize: 14,
    lineHeight: 20,
  },
  notice: { flexDirection: 'row', gap: 9, marginTop: 22, paddingHorizontal: 4 },
  noticeText: { flex: 1, color: C.textFaint, fontFamily: F.medium, fontSize: 13, lineHeight: 19 },
  switch: { alignSelf: 'center', minHeight: 48, justifyContent: 'center', marginTop: 10 },
  switchText: {
    color: C.textDim,
    fontFamily: F.semi,
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  bar: {
    paddingHorizontal: PAD,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: 'rgba(11,14,9,0.92)',
  },
});
