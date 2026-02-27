import * as React from 'react';
import { View, StyleSheet, Alert, Platform } from 'react-native';
import Config from 'react-native-config';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import {
  ActivityIndicator,
  Button,
  Icon,
  Text,
  Surface,
  useTheme,
} from 'react-native-paper';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getVersion, getBuildNumber } from 'react-native-device-info';
import { AuthStackParamList } from '../../navigation/StackParam';
import { trackEvent } from '../../service/analyticsTracker';
import { LoginWithGoogleIdToken } from '../../service/IdentityService';
import supabase from '../../service/SupabaseClient';

type NavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'RegisterScreen',
  'LoginScreen'
>;

export default function AuthScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const [googleLoading, setGoogleLoading] = React.useState(false);
  const appVersion = getVersion();
  const buildNumber = getBuildNumber();

  React.useEffect(() => {
    // Configure once per app launch. (Requires rebuild after changing `.env`.)
    const webClientId = Config.GOOGLE_WEB_CLIENT_ID?.trim?.();
    const iosClientId = Config.GOOGLE_IOS_CLIENT_ID?.trim?.();
    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      iosClientId: iosClientId || undefined,
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
  }, []);

  const handleLogin = () => {
    navigation.navigate('LoginScreen');
    trackEvent('Auth_Login_Opened', {
      source: 'Auth',
    });
  };

  const handleRegister = () => {
    navigation.navigate('RegisterScreen');
    trackEvent('Auth_Register_Opened', {
      source: 'Auth',
    });
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPasswordScreen');
    trackEvent('Auth_ForgotPassword_Opened', {
      source: 'Auth',
    });
  };

  const handleGoogleLogin = async () => {
    trackEvent('Auth_Google_Login_Clicked', { source: 'Auth' });
    const webClientId = Config.GOOGLE_WEB_CLIENT_ID?.trim?.();
    const iosClientId = Config.GOOGLE_IOS_CLIENT_ID?.trim?.();

    // iOS physical devices are most reliable with iosClientId configured.
    const hasConfig =
      Platform.OS === 'android' ? !!webClientId : !!iosClientId;

    if (!hasConfig) {
      Alert.alert(
        'Google login not configured',
        Platform.OS === 'android'
          ? 'Please set GOOGLE_WEB_CLIENT_ID in your .env file and rebuild the app.'
          : 'Please set GOOGLE_IOS_CLIENT_ID in your .env file and rebuild the app.',
      );
      return;
    }

    try {
      setGoogleLoading(true);

      // Start from a clean slate (prevents stale-account glitches on iOS devices).
      await GoogleSignin.signOut().catch(() => undefined);

      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices({
          showPlayServicesUpdateDialog: true,
        });
      }

      const res = await GoogleSignin.signIn();
      if (res.type !== 'success') return; // user cancelled

      const idToken = res.data.idToken;
      if (!idToken) {
        Alert.alert('Google login failed', 'Missing Google ID token.');
        return;
      }

      const tokens = await GoogleSignin.getTokens().catch(() => null as any);
      const accessToken =
        tokens?.accessToken && typeof tokens.accessToken === 'string'
          ? tokens.accessToken
          : undefined;

      const result = await LoginWithGoogleIdToken(idToken, accessToken);
      if (!result) {
        Alert.alert('Google login failed', 'Could not complete login. Please try again.');
        return;
      }
      if (result.error) {
        const msg =
          (result.error as any)?.message ||
          String(result.error ?? '') ||
          'Please try again.';
        Alert.alert('Google login failed', msg);
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        Alert.alert(
          'Google login failed',
          'Login completed, but a session was not created. Please check Supabase Google provider configuration and try again.',
        );
        return;
      }

      trackEvent('Auth_Google_Login_Success', {
        source: 'Auth',
        email: res.data.user?.email ?? '',
      });
      // Navigation is handled by the global auth listener in AppNavigator.
    } catch (e: any) {
      const code = e?.code as string | undefined;
      if (code === statusCodes.SIGN_IN_CANCELLED) return;
      if (code === statusCodes.IN_PROGRESS) return;

      const msg =
        e?.message ||
        (typeof e === 'string' ? e : '') ||
        'Please try again.';
      Alert.alert('Google login failed', msg);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View
      style={[styles.container, { backgroundColor: theme.colors.background }]}
    >
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

        <View
          style={[styles.heroDivider, { backgroundColor: outlineColor(theme) }]}
        />

        <View style={styles.featureRow}>
          <View
            style={[
              styles.featureIcon,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Icon
              source="flash-outline"
              size={16}
              color={theme.colors.primary}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text
              style={[styles.featureTitle, { color: theme.colors.onSurface }]}
            >
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
            <Text
              style={[styles.featureTitle, { color: theme.colors.onSurface }]}
            >
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
            <Icon
              source="rocket-launch-outline"
              size={18}
              color={theme.colors.primary}
            />
          </View>
          <Text
            style={[styles.sectionTitle, { color: theme.colors.onSurface }]}
          >
            Get started
          </Text>
        </View>

        <View
          style={[
            styles.buttonWrap,
            { backgroundColor: theme.colors.primary, shadowColor: shadowColor(theme) },
          ]}
        >
          <View style={styles.buttonClip}>
            <Button
              mode="contained"
              icon="login"
              onPress={handleLogin}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              compact
              buttonColor={theme.colors.primary}
              textColor={theme.colors.onPrimary}
              disabled={googleLoading}
            >
              Login
            </Button>
          </View>
        </View>

        <View
          style={[
            styles.buttonWrap,
            { backgroundColor: theme.colors.surface, shadowColor: shadowColor(theme) },
          ]}
        >
          <View style={styles.buttonClip}>
            <Button
              mode="outlined"
              icon="account-plus-outline"
              onPress={handleRegister}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              compact
              buttonColor={theme.colors.surface}
              textColor={theme.colors.primary}
              disabled={googleLoading}
            >
              Create account
            </Button>
          </View>
        </View>

        <View
          style={[
            styles.buttonWrap,
            { backgroundColor: theme.colors.surface, shadowColor: shadowColor(theme) },
          ]}
        >
          <View style={styles.buttonClip}>
            <Button
              mode="outlined"
              icon="google"
              onPress={() => {
                // Never allow an async onPress to leak a rejected Promise (Android redbox).
                handleGoogleLogin().catch((e: any) => {
                  Alert.alert(
                    'Google login failed',
                    e?.message ?? 'Please try again.',
                  );
                  setGoogleLoading(false);
                });
              }}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              buttonColor={theme.colors.surface}
              textColor={theme.colors.onSurface}
              compact
              disabled={googleLoading}
              loading={googleLoading}
            >
              Continue with Google
            </Button>
          </View>
        </View>

        <View
          style={[
            styles.buttonWrap,
            { backgroundColor: theme.colors.surface, shadowColor: shadowColor(theme) },
          ]}
        >
          <View style={styles.buttonClip}>
            <Button
              mode="outlined"
              icon="lock-reset"
              onPress={handleForgotPassword}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
              compact
              buttonColor={theme.colors.surface}
              textColor={theme.colors.onSurface}
              disabled={googleLoading}
            >
              Forgot Password?
            </Button>
          </View>
        </View>

      </Surface>

      <View style={styles.versionWrap}>
        <View
          style={[
            styles.versionPill,
            {
              backgroundColor: theme.colors.primaryContainer,
              borderColor: theme.colors.primary,
              shadowColor: shadowColor(theme),
            },
          ]}
        >
          <Icon source="tag-outline" size={14} color={theme.colors.primary} />
          <Text style={[styles.versionText, { color: theme.colors.primary }]}>
            v{appVersion} ({buildNumber})
          </Text>
        </View>
      </View>
    </View>
  );
}

function outlineColor(theme: any) {
  return (theme.colors as any).outlineVariant ?? theme.colors.outline;
}

function shadowColor(theme: any) {
  return (theme.colors as any).shadow ?? '#000';
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

  featureRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    marginBottom: 10,
  },
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
  buttonWrap: {
    width: '100%',
    marginBottom: 10,
    borderRadius: 14,
    // subtle lift (premium, not heavy)
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  // Important: avoid `overflow: 'hidden'` on Paper's `Button` (Surface) to prevent shadow warning.
  // Clip ripple + children here instead.
  buttonClip: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  button: {
    width: '100%',
    borderRadius: 14,
  },
  buttonContent: {
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  buttonLabel: {
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.15,
  },
  versionWrap: {
    alignItems: 'center',
    marginTop: 10,
  },
  versionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  versionText: {
    fontSize: 12,
    fontWeight: '700',
  },
});