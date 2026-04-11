import { useState } from 'react';
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

type Page = 'terms' | 'privacy' | 'help' | 'membership';

type Props = {
  onSignIn: () => void;
  onSignUp: () => void;
};

const TERMS_SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body: 'By accessing or using Versus, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.',
  },
  {
    title: 'Use of the App',
    body: 'Versus is intended for personal, non-commercial use. You agree to use the app in a lawful manner and not to misuse any features, including match results, rankings, or messaging.',
  },
  {
    title: 'Accounts',
    body: 'You are responsible for maintaining the confidentiality of your account credentials. You agree to provide accurate information and to notify us of any unauthorized use of your account.',
  },
  {
    title: 'Match Data',
    body: 'Match results, scores, and rankings you submit are stored and may be visible to other users. You agree not to submit false or misleading match data.',
  },
  {
    title: 'Prohibited Conduct',
    body: 'You may not harass other users, submit fraudulent match results, attempt to manipulate rankings, or use the app for any unlawful purpose.',
  },
  {
    title: 'Intellectual Property',
    body: 'All content, branding, and code within Versus are the property of Versus. You may not reproduce or distribute any part of the app without written permission.',
  },
  {
    title: 'Disclaimer',
    body: 'Versus is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the app.',
  },
  {
    title: 'Changes to Terms',
    body: 'We may update these Terms at any time. Continued use of the app after changes constitutes acceptance of the new Terms.',
  },
  {
    title: 'Contact',
    body: 'For questions about these Terms, contact us at support@versus.app.',
  },
];

const PRIVACY_SECTIONS = [
  {
    title: 'Information We Collect',
    body: 'We collect information you provide when creating an account (name, email, profile photo), match data you log (sport, score, location, participants), and device information for push notifications.',
  },
  {
    title: 'How We Use Your Information',
    body: 'We use your information to operate the app, calculate rankings, send match notifications, and improve our services. We do not sell your personal data to third parties.',
  },
  {
    title: 'Profile Visibility',
    body: 'Your display name, profile photo, sport ranks, and match history are visible to other Versus users. You can control follower access in your account settings.',
  },
  {
    title: 'Location Data',
    body: 'If you choose to add a location to a match, that location is stored and may be visible to match participants. We do not track your location in the background.',
  },
  {
    title: 'Push Notifications',
    body: 'We store your device push token to send match invites, results, and other in-app notifications. You can disable notifications at any time in your device settings.',
  },
  {
    title: 'Data Storage',
    body: 'Your data is stored securely using Supabase infrastructure. We apply industry-standard security measures to protect your information.',
  },
  {
    title: 'Data Deletion',
    body: 'You can request deletion of your account and associated data by contacting us at support@versus.app. Some data may be retained as required by law.',
  },
  {
    title: 'Third-Party Services',
    body: 'Versus uses third-party services including Supabase (database), Expo (push notifications), and Apple/Google (sign-in). These services have their own privacy policies.',
  },
  {
    title: 'Contact',
    body: 'For privacy questions or data requests, contact us at support@versus.app.',
  },
];

const HELP_SECTIONS = [
  {
    title: 'Getting Started',
    items: [
      { q: 'What is Versus?', a: 'Versus is a competitive sports app that lets you challenge friends to ranked and casual matches across 15+ sports. Track your wins, losses, and VP (Victory Points) to climb the ranks.' },
      { q: 'How do I create a match?', a: 'Tap the "+" button on the home screen. Select a sport, choose a format (1v1 or 2v2), pick ranked or casual, set a location and time, then invite your opponent.' },
      { q: 'What match types are available?', a: 'Ranked — affects your VP and rank. Casual — just for fun, no VP changes. Practice — no records kept.' },
    ],
  },
  {
    title: 'Ranking System',
    items: [
      { q: 'What are VP (Victory Points)?', a: 'VP are earned by winning ranked matches. Your total VP determines your rank tier — Beginner, Bronze, Silver, Gold, Platinum, Diamond, or Pro.' },
      { q: 'Can I lose my rank tier?', a: 'No. Rank tiers are permanent — you can never be demoted. VP can decrease from losses, but you keep your highest tier earned.' },
      { q: 'How does VP change per match?', a: 'Winning earns VP and losing costs VP. Upset wins (beating a higher-ranked player) award bonus VP.' },
    ],
  },
  {
    title: 'Account & Profile',
    items: [
      { q: 'How do I set my preferred sports?', a: 'Go to your Profile → tap your avatar or edit icon → Preferred Sports. Select up to 5 sports you play most.' },
      { q: 'How do I follow other players?', a: 'Search for a player using the search icon, visit their profile, and tap Follow. Private accounts require approval.' },
      { q: 'How do I delete my account?', a: 'Go to Settings → scroll to the bottom → Delete Account. This is permanent and removes all your data.' },
    ],
  },
  {
    title: 'Troubleshooting',
    items: [
      { q: 'I\'m not receiving notifications.', a: 'Check that notifications are enabled for Versus in your device Settings > Notifications. Also make sure you\'re logged in.' },
      { q: 'A match result is wrong. Can I fix it?', a: 'Tap the "..." menu on a match card to edit it (available to participants). Changes affect both players\' records.' },
      { q: 'How do I contact support?', a: 'Email us at support@versus.app and we\'ll get back to you as soon as possible.' },
    ],
  },
];

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

const MEMBERSHIP_FREE = [
  'Create & log matches with friends',
  'Casual and practice match types',
  'Full match history & scores',
  'Sport ranks & VP tracking',
  'Profile, follows & social feed',
  'Plan & schedule matches',
];

const MEMBERSHIP_PERKS = [
  'Find ranked match — get matched with opponents at your skill level',
  'Find casual match — discover players looking for a casual game nearby',
  'Priority matchmaking queue',
  'Exclusive member badge on your profile',
  'Early access to new sports & features',
];

export default function LandingScreen({ onSignIn, onSignUp }: Props) {
  const [page, setPage] = useState<Page | null>(null);

  if (page === 'terms' || page === 'privacy') {
    const sections = page === 'terms' ? TERMS_SECTIONS : PRIVACY_SECTIONS;
    const title = page === 'terms' ? 'Terms of Service' : 'Privacy Policy';
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.subPageNav}>
          <TouchableOpacity onPress={() => setPage(null)} style={styles.subPageBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={c.text} />
            <Text style={styles.subPageBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.subPageTitle}>{title}</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.subPageContent}>
          {sections.map((s) => (
            <View key={s.title} style={styles.subPageSection}>
              <Text style={styles.subPageSectionTitle}>{s.title}</Text>
              <Text style={styles.subPageBody}>{s.body}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.footer, { backgroundColor: SECTION_BG_ALT }]}>
          <Text style={styles.footerCopy}>© {new Date().getFullYear()} Versus. All rights reserved.</Text>
        </View>
      </ScrollView>
    );
  }

  if (page === 'help') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.subPageNav}>
          <TouchableOpacity onPress={() => setPage(null)} style={styles.subPageBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={c.text} />
            <Text style={styles.subPageBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.subPageTitle}>Help & FAQ</Text>
          <View style={{ width: 60 }} />
        </View>
        <View style={styles.subPageContent}>
          {HELP_SECTIONS.map((s) => (
            <View key={s.title} style={styles.subPageSection}>
              <Text style={styles.subPageSectionTitle}>{s.title}</Text>
              {s.items.map((item) => (
                <View key={item.q} style={styles.helpItem}>
                  <Text style={styles.helpQ}>{item.q}</Text>
                  <Text style={styles.helpA}>{item.a}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
        <View style={[styles.footer, { backgroundColor: SECTION_BG_ALT }]}>
          <Text style={styles.footerCopy}>© {new Date().getFullYear()} Versus. All rights reserved.</Text>
        </View>
      </ScrollView>
    );
  }

  if (page === 'membership') {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.subPageNav}>
          <TouchableOpacity onPress={() => setPage(null)} style={styles.subPageBack} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={20} color={c.text} />
            <Text style={styles.subPageBackText}>Back</Text>
          </TouchableOpacity>
          <Text style={styles.subPageTitle}>Membership</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Hero */}
        <View style={styles.membershipHero}>
          <View style={styles.membershipHeroBlob} />
          <View style={styles.membershipBadgeWrap}>
            <Ionicons name="shield-checkmark" size={36} color={c.primary} />
          </View>
          <Text style={styles.membershipHeroTitle}>Versus Membership</Text>
          <Text style={styles.membershipHeroSub}>
            Unlock the full Versus experience. Find opponents, get matched by skill level, and compete at a higher level.
          </Text>
          <TouchableOpacity style={styles.membershipCta} onPress={onSignUp} activeOpacity={0.85}>
            <Text style={styles.membershipCtaText}>Get Started — Sign Up</Text>
          </TouchableOpacity>
          <Text style={styles.membershipCtaNote}>Coming soon · Be the first to know when memberships launch</Text>
        </View>

        {/* Plans */}
        <View style={styles.subPageContent}>
          <View style={styles.membershipPlansRow}>
            {/* Free tier */}
            <View style={styles.membershipPlanCard}>
              <Text style={styles.membershipPlanLabel}>Free</Text>
              <Text style={styles.membershipPlanPrice}>$0</Text>
              <Text style={styles.membershipPlanPriceSub}>forever</Text>
              <View style={styles.membershipDivider} />
              {MEMBERSHIP_FREE.map((perk) => (
                <View key={perk} style={styles.membershipPerkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={c.textSecondary} />
                  <Text style={styles.membershipPerkText}>{perk}</Text>
                </View>
              ))}
            </View>

            {/* Member tier */}
            <View style={[styles.membershipPlanCard, styles.membershipPlanCardPro]}>
              <View style={styles.membershipPopularBadge}>
                <Text style={styles.membershipPopularText}>MEMBER</Text>
              </View>
              <Text style={[styles.membershipPlanLabel, { color: c.text }]}>Member</Text>
              <Text style={[styles.membershipPlanPrice, { color: c.primary }]}>Coming Soon</Text>
              <Text style={styles.membershipPlanPriceSub}>pricing TBA</Text>
              <View style={styles.membershipDivider} />
              <Text style={styles.membershipEverythingNote}>Everything in Free, plus:</Text>
              {MEMBERSHIP_PERKS.map((perk) => (
                <View key={perk} style={styles.membershipPerkRow}>
                  <Ionicons name="checkmark-circle" size={16} color={c.primary} />
                  <Text style={[styles.membershipPerkText, { color: c.text }]}>{perk}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <View style={[styles.footer, { backgroundColor: SECTION_BG_ALT }]}>
          <Text style={styles.footerCopy}>© {new Date().getFullYear()} Versus. All rights reserved.</Text>
        </View>
      </ScrollView>
    );
  }

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
          The sports social platform for serious rec players — schedule matches, log scores, and rank up across versus sports.
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
        <View style={styles.footerLinks}>
          <TouchableOpacity onPress={() => setPage('membership')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Membership</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={() => setPage('help')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Help</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={() => setPage('terms')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Terms of Service</Text>
          </TouchableOpacity>
          <Text style={styles.footerDot}>·</Text>
          <TouchableOpacity onPress={() => setPage('privacy')} activeOpacity={0.7}>
            <Text style={styles.footerLink}>Privacy Policy</Text>
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

  // ── Membership page ──
  membershipHero: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingHorizontal: PX,
    paddingVertical: spacing.xxl,
    backgroundColor: HERO_BG,
    overflow: 'hidden',
  },
  membershipHeroBlob: {
    position: 'absolute',
    width: 500,
    height: 500,
    borderRadius: 250,
    backgroundColor: '#1d4ed8',
    opacity: 0.09,
    top: -150,
    left: -100,
  },
  membershipBadgeWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: c.primary + '25',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: c.primary + '50',
  },
  membershipHeroTitle: {
    fontSize: isNarrow ? 28 : 42,
    fontWeight: '800',
    color: c.text,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  membershipHeroSub: {
    fontSize: isNarrow ? 15 : 18,
    color: c.textSecondary,
    textAlign: 'center',
    maxWidth: 560,
    lineHeight: isNarrow ? 24 : 28,
    marginBottom: spacing.xl,
  },
  membershipCta: {
    backgroundColor: c.primary,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  membershipCtaText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  membershipCtaNote: { fontSize: 12, color: c.textSecondary, textAlign: 'center' },
  membershipPlansRow: {
    flexDirection: isNarrow ? 'column' : 'row',
    gap: spacing.md,
    alignItems: isNarrow ? 'stretch' : 'flex-start',
  },
  membershipPlanCard: {
    flex: 1,
    backgroundColor: c.surface,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.xl,
  },
  membershipPlanCardPro: {
    borderColor: c.primary + '80',
    backgroundColor: c.primary + '0D',
  },
  membershipPopularBadge: {
    alignSelf: 'flex-start',
    backgroundColor: c.primary,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    marginBottom: spacing.sm,
  },
  membershipPopularText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 1 },
  membershipPlanLabel: { fontSize: 18, fontWeight: '700', color: c.textSecondary, marginBottom: spacing.xs },
  membershipPlanPrice: { fontSize: 32, fontWeight: '800', color: c.text },
  membershipPlanPriceSub: { fontSize: 13, color: c.textSecondary, marginBottom: spacing.md },
  membershipDivider: { height: 1, backgroundColor: c.border, marginBottom: spacing.md },
  membershipEverythingNote: { fontSize: 13, color: c.textSecondary, fontStyle: 'italic', marginBottom: spacing.sm },
  membershipPerkRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'flex-start' },
  membershipPerkText: { fontSize: 14, color: c.textSecondary, flex: 1, lineHeight: 20 },

  // ── Sub-pages (Terms, Privacy, Help) ──
  subPageNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: PX,
    height: 64,
    backgroundColor: HERO_BG,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  subPageBack: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, width: 60 },
  subPageBackText: { fontSize: 14, color: c.text, fontWeight: '500' },
  subPageTitle: { fontSize: 17, fontWeight: '700', color: c.text },
  subPageContent: {
    paddingHorizontal: PX,
    paddingVertical: spacing.xl,
    maxWidth: 760,
    alignSelf: 'center',
    width: '100%',
  },
  subPageSection: { marginBottom: spacing.xl },
  subPageSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.primary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  subPageBody: { fontSize: 15, color: c.textSecondary, lineHeight: 24 },
  helpItem: {
    backgroundColor: c.surface,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: c.border,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  helpQ: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: spacing.xs },
  helpA: { fontSize: 14, color: c.textSecondary, lineHeight: 22 },

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
