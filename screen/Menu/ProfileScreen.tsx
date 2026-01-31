import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Icon,
  IconButton,
  Avatar,
  Surface,
  Text,
  useTheme,
} from 'react-native-paper';
import { fetchUserProfile, UserProfile } from '../../service/MenuService';

export default function ProfileScreen() {
  const theme = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const data = await fetchUserProfile();
      setProfile(data);
    } catch (e) {
      console.error('Failed to load profile', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  const primaryTitle = fullName || 'Your Profile';
  const subtitleLine = profile?.email || profile?.mobile || '';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* HERO (match TenantView style) */}
      <Surface style={styles.hero} elevation={2}>
        <View style={[styles.avatarWrap, { backgroundColor: theme.colors.primaryContainer }]}>
          <Avatar.Icon
            size={88}
            icon="account-circle-outline"
            style={{ backgroundColor: 'transparent' }}
            color={theme.colors.primary}
          />
        </View>
        <View style={styles.heroText}>
          <Text variant="titleLarge" style={styles.heroTitle} numberOfLines={1}>
            {primaryTitle}
          </Text>
          {!!subtitleLine && (
            <Text style={styles.heroSub} numberOfLines={1}>
              {subtitleLine}
            </Text>
          )}
          <Text style={styles.heroMeta} numberOfLines={1}>
            Registered on{' '}
            {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '-'}
          </Text>
        </View>
      </Surface>

      <Section title="Basic Information">
        <InfoRow icon="account-outline" label="First name" value={profile?.first_name} />
        <InfoRow icon="account-outline" label="Last name" value={profile?.last_name} />
      </Section>

      <Section title="Contact">
        <InfoRow icon="phone" label="Mobile" value={profile?.mobile} />
        <InfoRow icon="email-outline" label="Email" value={profile?.email} />
      </Section>

      <Section title="Address">
        <InfoRow icon="map-marker" label="Address" value={profile?.address} />
      </Section>
    </ScrollView>
  );
}

/* ---------------- UI COMPONENTS (match TenantView) ---------------- */

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Surface style={styles.section} elevation={2}>
    <Text variant="titleMedium" style={styles.sectionTitle}>
      {title}
    </Text>
    {children}
  </Surface>
);

const InfoRow = ({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value?: string | number | null;
}) => (
  <View style={styles.infoRow}>
    <IconButton icon={icon} size={18} />
    <View style={{ flex: 1 }}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={2}>
        {value ?? '-'}
      </Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 24 },

  hero: {
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarWrap: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  heroText: { flex: 1, marginLeft: 16 },
  heroTitle: { fontWeight: '700', fontSize: 25 },
  heroSub: { color: '#666', marginTop: 4, fontSize: 16 },
  heroMeta: { color: '#888', marginTop: 2, fontSize: 14, fontWeight: '500' },

  section: { borderRadius: 16, padding: 16, marginBottom: 16 },
  sectionTitle: { fontWeight: '600', marginBottom: 12, fontSize: 19 },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoLabel: { fontSize: 14, color: '#888' },
  infoValue: { fontSize: 18, fontWeight: '500' },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});