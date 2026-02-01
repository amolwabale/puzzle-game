import * as React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button, Icon, Text, Surface, useTheme } from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/StackParam';

type NavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'RegisterScreen',
  'LoginScreen'
>;

export default function AuthScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();

  const handleLogin = () => {
    navigation.navigate('LoginScreen');
  };

  const handleRegister = () => {
    navigation.navigate('RegisterScreen');
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Soft background accents (peaceful / welcoming) */}
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
      </View>

      {/* HERO */}
      <Surface
        style={[
          styles.hero,
          {
            backgroundColor: theme.colors.surface,
            borderColor: outlineColor(theme),
          },
        ]}
        elevation={2}
      >
        <View style={styles.heroRow}>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon
              source="home-city-outline"
              size={20}
              color={theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.heroTitle, { color: theme.colors.onSurface }]}
              numberOfLines={2}
            >
              Welcome to Tenant Manager
            </Text>
            <Text
              style={[styles.heroSub, { color: theme.colors.onSurfaceVariant }]}
              numberOfLines={2}
            >
              A calm, simple way to manage rooms, tenants, and rent collection.
            </Text>
          </View>
        </View>

        <View style={[styles.heroDivider, { backgroundColor: outlineColor(theme) }]} />

        <View style={styles.featureRow}>
          <View
            style={[
              styles.featureIcon,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Icon source="flash-outline" size={16} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
              Faster billing
            </Text>
            <Text
              style={[
                styles.featureSub,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              Generate and track payments in minutes.
            </Text>
          </View>
        </View>

        <View style={styles.featureRow}>
          <View
            style={[
              styles.featureIcon,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Icon
              source="shield-check-outline"
              size={16}
              color={theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={[styles.featureTitle, { color: theme.colors.onSurface }]}>
              Clean records
            </Text>
            <Text
              style={[
                styles.featureSub,
                { color: theme.colors.onSurfaceVariant },
              ]}
              numberOfLines={1}
            >
              Keep everything organized and easy to find.
            </Text>
          </View>
        </View>
      </Surface>

      {/* ACTIONS */}
      <Surface
        style={[
          styles.card,
          {
            backgroundColor: theme.colors.surface,
            borderColor: outlineColor(theme),
          },
        ]}
        elevation={2}
      >
        <View style={styles.sectionTitleRow}>
          <View
            style={[
              styles.sectionIcon,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Icon source="rocket-launch-outline" size={18} color={theme.colors.primary} />
          </View>
          <Text style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
            Get started
          </Text>
        </View>

        <Button
          mode="contained"
          icon="login"
          onPress={handleLogin}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Login
        </Button>

        <Button
          mode="outlined"
          icon="account-plus-outline"
          onPress={handleRegister}
          style={styles.button}
          contentStyle={styles.buttonContent}
        >
          Create account
        </Button>

        <Text
          style={[styles.footerHint, { color: theme.colors.onSurfaceVariant }]}
        >
          Tip: You can create an account once and use it across devices.
        </Text>
      </Surface>
    </View>
  );
}

function outlineColor(theme: any) {
  return (theme.colors as any).outlineVariant ?? theme.colors.outline;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
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
    right: -70,
  },

  hero: {
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: { fontWeight: '900', fontSize: 18, letterSpacing: 0.2 },
  heroSub: { marginTop: 2, fontWeight: '700', fontSize: 13, lineHeight: 18 },
  heroDivider: { height: 1, marginTop: 12, marginBottom: 12, opacity: 0.6 },

  featureRow: { flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 10 },
  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTitle: { fontWeight: '900', fontSize: 13 },
  featureSub: { marginTop: 1, fontWeight: '700', fontSize: 12 },

  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: { fontWeight: '900', fontSize: 16 },
  button: {
    width: '100%',
    marginBottom: 12,
  },
  buttonContent: {
    paddingVertical: 10,
  },
  footerHint: {
    marginTop: 6,
    fontWeight: '700',
    fontSize: 12,
    lineHeight: 16,
  },
});
