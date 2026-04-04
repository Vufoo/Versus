import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { darkColors, spacing, borderRadius } from '../constants/theme';
import { SPORT_EMOJI } from '../constants/sports';

const c = darkColors;
const { width: W } = Dimensions.get('window');
const isNarrow = W < 700;

const MAX_W = 1280;

type Props = {
  onSignIn: () => void;
  onSignUp: () => void;
};

const FEATURES = [
  {
    icon: 'trophy-outline' as const,
    title: 'Ranked Matches',
    desc: 'Compete in ranked matches and climb the leaderboard for your sport.',
  },
  {
    icon: 'person-add-outline' as const,
    title: 'Invite Friends to Play',
    desc: 'Invite your friends and start competing. Challenge them to a match and keep the rivalry going.',
  },
  {
    icon: 'stats-chart-outline' as const,
    title: 'Track Every Game',
    desc: 'Log ranked, casual, and practice matches. Every game counts toward your history and growth.',
  },
  {
    icon: 'calendar-outline' as const,
    title: 'Plan & Schedule',
    desc: 'Organize matches with friends, set a time and location, and get reminders.',
  },
];

const SPORTS = [
  'Tennis', 'Pickleball', 'Badminton', 'Ping Pong',
  'Racquetball', 'Squash', 'Basketball', 'Golf', 'Volleyball',
];

export default function LandingScreen({ onSignIn, onSignUp }: Props) {
  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Nav ── */}
      <View style={styles.navOuter}>
        <View style={styles.nav}>
          <View style={styles.navLogo}>
            <Image source={require('../../assets/icon_dark_mode.png')} style={styles.navIcon} />
          </View>
          <View style={styles.navActions}>
            <TouchableOpacity style={styles.navLogIn} onPress={onSignIn} activeOpacity={0.85}>
              <Text style={styles.navLogInText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Hero ── */}
      <View style={styles.heroOuter}>
        <View style={styles.hero}>
          {/* wordmark as hero logo */}
          <Image source={require('../../assets/versus_dark.png')} style={styles.heroLogo} />
          <Text style={styles.heroHeadline}>
            {'Track. '}
            <Text style={styles.heroHeadlineBold}>Versus</Text>
            {'. Dominate.'}
          </Text>
          <Text style={styles.heroSub}>
            The sports social platform for serious rec players — schedule matches, log scores, and rank up across 9 sports.
          </Text>
          <View style={styles.heroCtas}>
            <TouchableOpacity style={styles.ctaPrimary} onPress={onSignUp} activeOpacity={0.85}>
              <Text style={styles.ctaPrimaryText}>Create Free Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ctaSecondary} onPress={onSignIn} activeOpacity={0.75}>
              <Text style={styles.ctaSecondaryText}>Log In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* ── Features ── */}
      <View style={styles.sectionOuter}>
        <View style={styles.sectionInner}>
          <Text style={styles.sectionLabel}>Why Versus</Text>
          <Text style={styles.sectionTitle}>Everything your game needs</Text>
          <View style={styles.featuresGrid}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.featureCard}>
                <View style={styles.featureIconWrap}>
                  <Ionicons name={f.icon} size={34} color={c.primaryLight} />
                </View>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>

      {/* ── Sports ── */}
      <View style={styles.sectionOuter}>
        <View style={styles.sectionInner}>
          <Text style={styles.sectionLabel}>Sports</Text>
          <Text style={styles.sectionTitle}>9 sports and counting</Text>
          <View style={styles.sportsCard}>
            <View style={styles.sportsGrid}>
              {SPORTS.map((sport) => (
                <View key={sport} style={styles.sportChip}>
                  <Text style={styles.sportEmoji}>{SPORT_EMOJI[sport] ?? '🏆'}</Text>
                  <Text style={styles.sportName}>{sport}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>

      {/* ── App Store Download ── */}
      <View style={styles.sectionOuter}>
        <View style={[styles.sectionInner, styles.appStoreSectionInner]}>
          <Image source={require('../../assets/icon_dark_mode.png')} style={styles.appStoreIcon} />
          <TouchableOpacity style={styles.appStoreBtn} activeOpacity={0.85}>
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <View>
              <Text style={styles.appStoreBtnSub}>Download on the</Text>
              <Text style={styles.appStoreBtnMain}>App Store</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footerOuter}>
        <View style={styles.footerInner}>
          <Text style={styles.footerBrand}>Versus</Text>
          <Text style={styles.footerTagline}>The sports competitive tracking app.</Text>
          <View style={styles.footerLinks}>
            <TouchableOpacity onPress={onSignIn} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Log In</Text>
            </TouchableOpacity>
            <Text style={styles.footerDot}>·</Text>
            <TouchableOpacity onPress={onSignUp} activeOpacity={0.7}>
              <Text style={styles.footerLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.footerCopy}>© {new Date().getFullYear()} Versus. All rights reserved.</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  content: { alignItems: 'stretch' },

  // Shared outer/inner
  sectionOuter: { width: '100%', alignItems: 'center' },
  sectionInner: {
    width: '100%',
    maxWidth: MAX_W,
    paddingHorizontal: isNarrow ? spacing.lg : spacing.xxl,
    paddingVertical: spacing.xxl,
  },

  // Nav
  navOuter: {
    width: '100%',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  nav: {
    width: '100%',
    maxWidth: MAX_W,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: isNarrow ? spacing.lg : spacing.xxl,
    paddingVertical: spacing.sm,
  },
  navLogo: { flexDirection: 'row', alignItems: 'center' },
  navIcon: { width: 48, height: 48, resizeMode: 'contain' },
  navActions: { flexDirection: 'row', alignItems: 'center' },
  navLogIn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
  },
  navLogInText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // Hero
  heroOuter: { width: '100%', alignItems: 'center' },
  hero: {
    width: '100%',
    maxWidth: MAX_W,
    alignItems: 'center',
    paddingHorizontal: isNarrow ? spacing.lg : spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
  },
  heroLogo: {
    width: isNarrow ? 220 : 340,
    height: isNarrow ? 72 : 110,
    resizeMode: 'contain',
    marginBottom: spacing.md,
  },
  heroHeadline: {
    fontSize: isNarrow ? 36 : 60,
    fontWeight: '700',
    color: c.text,
    textAlign: 'center',
    letterSpacing: -0.5,
    lineHeight: isNarrow ? 46 : 74,
    marginBottom: spacing.lg,
  },
  heroHeadlineBold: {
    fontSize: isNarrow ? 40 : 66,
    fontWeight: '900',
    color: c.primary,
  },
  heroSub: {
    fontSize: isNarrow ? 16 : 20,
    color: c.textSecondary,
    textAlign: 'center',
    maxWidth: 620,
    lineHeight: isNarrow ? 25 : 32,
    marginBottom: spacing.xl,
  },
  heroCtas: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: {
    backgroundColor: c.primary,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  ctaPrimaryText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  ctaSecondary: {
    borderWidth: 1.5,
    borderColor: c.border,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  ctaSecondaryText: { fontSize: 17, fontWeight: '700', color: c.text },

  // Section labels / titles
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.primaryLight,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: isNarrow ? 26 : 38,
    fontWeight: '800',
    color: c.text,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },

  // Features — 2×2 grid
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    width: '100%',
  },
  featureCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.primary + '40',
    padding: spacing.xl,
    width: isNarrow ? '100%' : '48%',
    flexShrink: 0,
  },
  featureIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: c.primary + '40',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  featureTitle: { fontSize: 17, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
  featureDesc: { fontSize: 15, color: c.textSecondary, lineHeight: 23 },

  // Sports card — matches feature card style
  sportsCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.primary + '40',
    padding: spacing.xl,
    width: '100%',
  },
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: spacing.sm,
  },
  sportChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: c.cardBg,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: borderRadius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  sportEmoji: { fontSize: 18 },
  sportName: { fontSize: 14, fontWeight: '600', color: c.text },

  // App Store section
  appStoreSectionInner: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
  appStoreIcon: {
    width: 160,
    height: 160,
    resizeMode: 'contain',
  },
  appStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#111',
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  appStoreBtnSub: { fontSize: 10, color: '#ffffffcc', fontWeight: '400', letterSpacing: 0.3 },
  appStoreBtnMain: { fontSize: 16, color: '#fff', fontWeight: '700', lineHeight: 20 },

  // Footer
  footerOuter: {
    width: '100%',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  footerInner: {
    width: '100%',
    maxWidth: MAX_W,
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: isNarrow ? spacing.lg : spacing.xxl,
  },
  footerBrand: { fontSize: 17, fontWeight: '800', color: c.primary, marginBottom: spacing.xs },
  footerTagline: { fontSize: 13, color: c.textSecondary, marginBottom: spacing.md },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  footerLink: { fontSize: 13, color: c.primaryLight, fontWeight: '600' },
  footerDot: { fontSize: 13, color: c.textSecondary },
  footerCopy: { fontSize: 11, color: c.textSecondary },
});
