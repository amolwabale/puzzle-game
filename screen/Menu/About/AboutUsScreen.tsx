import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Icon, Surface, Text, TouchableRipple, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export default function AboutUsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();

  const appVersion = getVersion();
  const buildNumber = getBuildNumber();

  const goToSupport = () => {
    navigation.navigate('MenuTabs', { screen: 'MenuSupport' });
  };

  return (
    <View style={styles.stage}>
      <View pointerEvents="none" style={styles.bgAccents}>
        <View
          style={[
            styles.blob,
            styles.blobOne,
            { backgroundColor: theme.colors.primaryContainer, opacity: 0.55 },
          ]}
        />
        <View
          style={[
            styles.blob,
            styles.blobTwo,
            { backgroundColor: theme.colors.secondaryContainer, opacity: 0.45 },
          ]}
        />
        <View
          style={[
            styles.blob,
            styles.blobThree,
            { backgroundColor: theme.colors.tertiaryContainer ?? theme.colors.primaryContainer, opacity: 0.3 },
          ]}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero */}
        <View style={styles.heroSection}>
          <View
            style={[
              styles.appIconWrap,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <MaterialCommunityIcons
              name="home-city"
              size={40}
              color={theme.colors.primary}
            />
          </View>
          <Text style={styles.appName}>Tenant Manager</Text>
          <Text style={styles.tagline}>
            Simplify your property management
          </Text>
        </View>

        {/* Intro */}
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon source="information-outline" size={18} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardTitle}>What is Tenant Manager?</Text>
          </View>
          <Text style={styles.cardBody}>
            Tenant Manager is your all-in-one solution to manage rental properties effortlessly.
            Track tenants, rooms, rent payments, utility bills, and generate billing summaries —
            all from your pocket.
          </Text>
        </Surface>

        {/* Cloud storage highlight */}
        <Surface
          style={[
            styles.card,
            styles.highlightCard,
            {
              borderColor: theme.colors.primary,
              backgroundColor: theme.colors.primaryContainer,
            },
          ]}
          elevation={3}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.cardIcon, { backgroundColor: theme.colors.surface }]}>
              <Icon source="cloud-check-outline" size={18} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Saved in the cloud</Text>
          </View>
          <Text style={styles.cardBody}>
            Your information is saved safely on cloud. If you change phones, log in on another
            device, or remove and reinstall the app, you can still see your tenants, rooms, and
            payment records after you sign in.
          </Text>
        </Surface>

        {/* Features */}
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon source="star-four-points-outline" size={18} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Key features</Text>
          </View>

          <FeatureBullet icon="account-group" text="Manage tenants, rooms & occupancy" />
          <FeatureBullet icon="cash-register" text="Record rent and utility payments" />
          <FeatureBullet icon="chart-timeline-variant" text="Dashboard with billing insights" />
          <FeatureBullet icon="file-document-outline" text="Store tenant documents securely" />
          <FeatureBullet icon="cog-outline" text="Customisable property settings" />
        </Surface>

        {/* Support */}
        <Surface style={styles.card} elevation={2}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.cardIcon,
                { backgroundColor: theme.colors.primaryContainer },
              ]}
            >
              <Icon source="lifebuoy" size={18} color={theme.colors.primary} />
            </View>
            <Text style={styles.cardTitle}>Need help?</Text>
          </View>
          <Text style={styles.cardBody}>
            Facing an issue or have a suggestion? Raise a support ticket and our team will get
            back to you. We also welcome feature requests — your ideas help shape the product.
          </Text>

          <TouchableRipple
            onPress={goToSupport}
            borderless
            style={[styles.supportBtn, { borderColor: theme.colors.primary }]}
          >
            <View style={styles.supportBtnInner}>
              <MaterialCommunityIcons
                name="lifebuoy"
                size={18}
                color={theme.colors.primary}
              />
              <Text style={[styles.supportBtnText, { color: theme.colors.primary }]}>
                Go to Support
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={20}
                color={theme.colors.primary}
              />
            </View>
          </TouchableRipple>
        </Surface>

        {/* Version footer */}
        <View style={styles.versionWrap}>
          <View
            style={[
              styles.versionPill,
              {
                backgroundColor: theme.colors.primaryContainer,
                borderColor: theme.colors.primary,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="tag-outline"
              size={14}
              color={theme.colors.primary}
            />
            <Text style={[styles.versionText, { color: theme.colors.primary }]}>
              v{appVersion} ({buildNumber})
            </Text>
          </View>
          <Text style={styles.copyright}>Made with care for property owners</Text>
        </View>
      </ScrollView>
    </View>
  );
}

function FeatureBullet({ icon, text }: { icon: string; text: string }) {
  const theme = useTheme();
  return (
    <View style={styles.bulletRow}>
      <View
        style={[
          styles.bulletIcon,
          { backgroundColor: theme.colors.primaryContainer },
        ]}
      >
        <MaterialCommunityIcons name={icon} size={16} color={theme.colors.primary} />
      </View>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    flex: 1,
    backgroundColor: '#F4F6FA',
    overflow: 'hidden',
  },
  bgAccents: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  blob: {
    position: 'absolute',
    borderRadius: 999,
  },
  blobOne: {
    width: 260,
    height: 260,
    top: -90,
    left: -70,
  },
  blobTwo: {
    width: 220,
    height: 220,
    bottom: -90,
    right: -60,
  },
  blobThree: {
    width: 180,
    height: 180,
    top: '40%',
    left: -50,
  },

  scroll: { flex: 1 },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },

  /* Hero */
  heroSection: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 8,
  },
  appIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  appName: {
    fontWeight: '900',
    fontSize: 24,
    color: '#111827',
    letterSpacing: 0.3,
  },
  tagline: {
    marginTop: 4,
    fontWeight: '800',
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },

  /* Cards */
  card: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  highlightCard: {
    borderWidth: 1.5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  cardIcon: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontWeight: '900',
    fontSize: 16,
    color: '#111827',
    flex: 1,
  },
  cardBody: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    color: '#374151',
  },

  /* Feature bullets */
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
  },
  bulletIcon: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    color: '#374151',
  },

  /* Support button */
  supportBtn: {
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  supportBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  supportBtnText: {
    flex: 1,
    fontWeight: '900',
    fontSize: 14,
  },

  /* Version */
  versionWrap: {
    alignItems: 'center',
    marginTop: 10,
    gap: 8,
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  versionText: {
    fontWeight: '900',
    fontSize: 12,
  },
  copyright: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});
