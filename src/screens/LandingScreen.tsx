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

const HERO_BG = '#060b18';
const SECTION_BG_ALT = '#090e1c';
const PX = isNarrow ? spacing.lg : spacing.xxl; // horizontal page padding

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

      {/* ── Hero ── */}
      <View style={styles.hero}>
        <View style={styles.heroBlobLeft} />
        <View style={styles.heroBlobRight} />
        <Image source={require('../../assets/versus_dark.png')} style={styles.heroLogo} />
        <Text style={styles.heroHeadline}>
          {'Track. '}
          <Text style={styles.heroHeadlineBold}>Versus</Text>
          {'. Dominate.'}
        </Text>
        <Text style={styles.heroSub}>
          The sports social platform for serious rec players — schedule matches, log scores, and rank up across 9 sports and counting.
        </Text>
        <View style={styles.heroCtas}>
          <TouchableOpacity style={styles.ctaPrimary} onPress={onSignUp} activeOpacity={0.85}>
            <Text style={styles.ctaPrimaryText}>Sign Up</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.ctaSecondary} onPress={onSignIn} activeOpacity={0.75}>
            <Text style={styles.ctaSecondaryText}>Log In</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.heroAppStore}>
          <TouchableOpacity style={styles.appStoreBtn} activeOpacity={0.85}>
            <Ionicons name="logo-apple" size={20} color="#fff" />
            <View>
              <Text style={styles.appStoreBtnSub}>Download on the</Text>
              <Text style={styles.appStoreBtnMain}>App Store</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Features ── */}
      <View style={[styles.section, { backgroundColor: SECTION_BG_ALT }]}>
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

      {/* ── Sports ── */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Sports</Text>
        <Text style={styles.sectionTitle}>Sports Included</Text>
        <View style={styles.sportsGrid}>
          {SPORTS.map((sport) => (
            <View key={sport} style={styles.sportTile}>
              <View style={styles.sportTileIconWrap}>
                <Text style={styles.sportTileEmoji}>{SPORT_EMOJI[sport] ?? '🏆'}</Text>
              </View>
              <Text style={styles.sportTileName}>{sport}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* ── Footer ── */}
      <View style={[styles.footer, { backgroundColor: SECTION_BG_ALT }]}>
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

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: c.background },
  content: { alignSelf: 'stretch', flexGrow: 1 },

  // ── Nav ──
  nav: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PX,
    height: 64,
    backgroundColor: HERO_BG,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    overflow: 'visible',
  },
  navLogo: { flexDirection: 'row', alignItems: 'center', overflow: 'visible' },
  navIcon: { width: 120, height: 120, resizeMode: 'contain' },
  navActions: { flexDirection: 'row', alignItems: 'center' },
  navLogIn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: c.primary,
    borderRadius: borderRadius.md,
  },
  navLogInText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  // ── Hero ──
  hero: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: PX,
    paddingTop: spacing.xl,
    paddingBottom: spacing.xl,
    backgroundColor: HERO_BG,
    overflow: 'hidden',
  },
  heroBlobLeft: {
    position: 'absolute',
    width: 600,
    height: 600,
    borderRadius: 300,
    backgroundColor: '#1d4ed8',
    opacity: 0.08,
    top: -200,
    left: -180,
  },
  heroBlobRight: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: '#3b82f6',
    opacity: 0.07,
    bottom: -150,
    right: -150,
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
    maxWidth: 680,
    lineHeight: isNarrow ? 25 : 32,
    marginBottom: spacing.xl,
  },
  heroCtas: { flexDirection: 'row', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  ctaPrimary: {
    backgroundColor: c.primary,
    width: 140,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  ctaPrimaryText: { fontSize: 17, fontWeight: '700', color: '#fff' },
  ctaSecondary: {
    borderWidth: 1.5,
    borderColor: c.border,
    width: 140,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    alignItems: 'center',
  },
  ctaSecondaryText: { fontSize: 17, fontWeight: '700', color: c.text },
  heroAppStore: { alignItems: 'center', marginTop: spacing.md },
  appStoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: '#111',
    borderRadius: 10,
    width: 210,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: '#3a3a3a',
  },
  appStoreBtnSub: { fontSize: 10, color: '#ffffffcc', fontWeight: '400', letterSpacing: 0.3 },
  appStoreBtnMain: { fontSize: 16, color: '#fff', fontWeight: '700', lineHeight: 20 },

  // ── Shared section ──
  section: {
    alignSelf: 'stretch',
    paddingHorizontal: PX,
    paddingVertical: spacing.xxl,
  },
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

  // ── Features ──
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  featureCard: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.primary + '40',
    padding: spacing.xl,
    flex: 1,
    flexBasis: isNarrow ? '100%' : '45%',
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

  // ── Sports ──
  sportsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    justifyContent: 'center',
  },
  sportTile: {
    width: isNarrow ? '28%' : 108,
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.sm,
    gap: spacing.sm,
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.primary + '40',
  },
  sportTileIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: c.primary + '30',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sportTileEmoji: { fontSize: 28 },
  sportTileName: { fontSize: 13, fontWeight: '600', color: c.text, textAlign: 'center' },

  // ── Footer ──
  footer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: PX,
    borderTopWidth: 1,
    borderTopColor: c.border,
  },
  footerBrand: { fontSize: 17, fontWeight: '800', color: c.primary, marginBottom: spacing.xs },
  footerTagline: { fontSize: 13, color: c.textSecondary, marginBottom: spacing.md },
  footerLinks: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  footerLink: { fontSize: 13, color: c.primaryLight, fontWeight: '600' },
  footerDot: { fontSize: 13, color: c.textSecondary },
  footerCopy: { fontSize: 11, color: c.textSecondary },
});
