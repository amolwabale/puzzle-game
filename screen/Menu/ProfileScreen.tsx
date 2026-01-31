import { useFocusEffect } from '@react-navigation/native';
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  ActivityIndicator,
  Button,
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
  const [profile, setProfile] = React.useState<UserProfile | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadProfile = React.useCallback(async () => {
    try {
      setError(null);
      setLoading(true);
      const data = await fetchUserProfile();
      setProfile(data);
    } catch (e) {
      console.error('Failed to load profile', e);
      setError((e as any)?.message || 'Could not load profile');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
  const primaryTitle = fullName || 'Your Profile';
  const subtitleLine = profile?.email || profile?.mobile || '-';
  const createdLine = profile?.created_at
    ? `Registered ${new Date(profile.created_at).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })}`
    : 'Registered -';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* 
        ✅ Support-module standard: single top card with icon + hierarchy + meta pill.
        Business logic unchanged; only presentation refactor.
      */}
      <Surface style={styles.heroCard} elevation={2}>
        <View style={styles.heroTopRow}>
          <View style={[styles.heroIcon, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="account-circle-outline" size={18} color={theme.colors.primary} />
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.heroKicker} numberOfLines={1}>
              Profile
            </Text>
            <Text style={styles.heroTitle} numberOfLines={1}>
              {primaryTitle}
            </Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {subtitleLine}
            </Text>
          </View>

          <Avatar.Text
            size={44}
            label={(fullName || 'U')
              .trim()
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((p) => p[0]?.toUpperCase())
              .join('')}
            style={{ backgroundColor: theme.colors.primaryContainer }}
            color={theme.colors.primary}
          />
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaPill}>
            <Icon source="calendar" size={14} color="#6B7280" />
            <Text style={styles.metaText} numberOfLines={1}>
              {createdLine}
            </Text>
          </View>
          <Button mode="text" onPress={() => void loadProfile()} icon="refresh" compact>
            Refresh
          </Button>
        </View>
      </Surface>

      {error ? (
        <Surface style={styles.noticeCard} elevation={1}>
          <View style={styles.noticeRow}>
            <View style={[styles.noticeIcon, { backgroundColor: theme.colors.primaryContainer }]}>
              <Icon source="alert-circle-outline" size={18} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.noticeTitle}>Could not load profile</Text>
              <Text style={styles.noticeSub} numberOfLines={2}>
                {error}
              </Text>
            </View>
            <IconButton icon="refresh" onPress={() => void loadProfile()} />
          </View>
        </Surface>
      ) : null}

      <Section title="Basic information">
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

/* ---------------- UI COMPONENTS (Support-module standard) ---------------- */

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

  heroCard: { borderRadius: 18, padding: 14, marginBottom: 14, backgroundColor: '#FFFFFF' },
  heroTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIcon: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroKicker: { fontWeight: '900', fontSize: 12, color: '#6B7280', letterSpacing: 0.6 },
  heroTitle: { marginTop: 2, fontWeight: '900', fontSize: 18, color: '#111827' },
  heroSub: { marginTop: 2, fontWeight: '800', fontSize: 13, color: '#6B7280' },
  heroMetaRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
    maxWidth: '72%',
  },
  metaText: { fontSize: 12, fontWeight: '800', color: '#6B7280' },

  noticeCard: { borderRadius: 18, padding: 14, marginBottom: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E5E7EB' },
  noticeRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  noticeIcon: { width: 36, height: 36, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  noticeTitle: { fontWeight: '900', fontSize: 15, color: '#111827' },
  noticeSub: { marginTop: 2, fontWeight: '800', fontSize: 13, color: '#6B7280' },

  section: { borderRadius: 18, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  sectionTitle: { fontWeight: '900', marginBottom: 12, fontSize: 15, color: '#111827' },
  infoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  infoLabel: { fontSize: 12, fontWeight: '800', color: '#6B7280' },
  infoValue: { fontSize: 15, fontWeight: '800', color: '#111827', marginTop: 2 },

  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});