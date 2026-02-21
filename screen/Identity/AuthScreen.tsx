import * as React from 'react';
import { View, StyleSheet, Alert, Platform, Linking } from 'react-native';
import Config from 'react-native-config';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import InAppBrowser from 'react-native-inappbrowser-reborn';
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
  const oauthTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const oauthInFlightRef = React.useRef(false);
  const handledRedirectUrlRef = React.useRef<string>('');
  const handledAuthCodeRef = React.useRef<string>('');

  const clearOauthTimer = React.useCallback(() => {
    oauthInFlightRef.current = false;
    if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
    oauthTimeoutRef.current = null;
  }, []);

  const getUrlParam = React.useCallback((url: string, key: string) => {
    // Supports query params and hash fragments.
    const re = new RegExp(`[?#&]${key}=([^&]+)`, 'i');
    const m = url.match(re);
    try {
      return m?.[1] ? decodeURIComponent(m[1]) : '';
    } catch {
      // If decoding fails (rare), fall back to raw value.
      return m?.[1] ?? '';
    }
  }, []);

  const handleSupabaseOAuthRedirect = React.useCallback(
    async (url: string) => {
      // Only handle our OAuth callback route.
      if (!url.startsWith('tenantmanager://auth')) return;

      // Avoid double-handling the same redirect (Linking event + openAuth result).
      if (handledRedirectUrlRef.current === url) return;
      handledRedirectUrlRef.current = url;

      // Supabase may return either:
      // - PKCE: tenantmanager://auth?code=...
      // - Implicit: tenantmanager://auth#access_token=...&refresh_token=...
      const errorDesc =
        getUrlParam(url, 'error_description') || getUrlParam(url, 'error');
      if (errorDesc) {
        clearOauthTimer();
        setGoogleLoading(false);
        Alert.alert('Google login failed', errorDesc);
        return;
      }

      const code = getUrlParam(url, 'code');
      const accessToken = getUrlParam(url, 'access_token');
      const refreshToken = getUrlParam(url, 'refresh_token');

      try {
        if (code) {
          // Exchange should happen only once per code.
          if (handledAuthCodeRef.current === code) return;
          handledAuthCodeRef.current = code;
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          // Not a supabase auth callback we understand.
          return;
        }

        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          throw new Error('Session was not created after OAuth redirect.');
        }

        trackEvent('Auth_Google_Login_Success', {
          source: 'Auth',
          email: data.session.user?.email ?? '',
        });
      } catch (e: any) {
        Alert.alert('Google login failed', e?.message ?? 'Please try again.');
      } finally {
        clearOauthTimer();
        setGoogleLoading(false);
      }
    },
    [clearOauthTimer, getUrlParam],
  );

  React.useEffect(() => {
    // Configure once per app launch. (Requires rebuild after changing `.env`.)
    const webClientId = Config.GOOGLE_WEB_CLIENT_ID?.trim?.();
    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      offlineAccess: false,
      forceCodeForRefreshToken: false,
    });
  }, []);

  React.useEffect(() => {
    const onUrl = async (evt: { url: string }) => {
      const url = evt.url ?? '';
      if (!url) return;

      try {
        await handleSupabaseOAuthRedirect(url);
      } catch (e: any) {
        // Never let deep-link handling crash the app.
        Alert.alert('Google login failed', e?.message ?? 'Please try again.');
        clearOauthTimer();
        setGoogleLoading(false);
      }
    };

    const sub = Linking.addEventListener('url', onUrl);

    // Handle cold start deep link (rare but important).
    Linking.getInitialURL().then(initial => {
      if (initial) onUrl({ url: initial });
    });

    return () => {
      sub.remove();
      if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
    };
  }, [handleSupabaseOAuthRedirect]);

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

  const handleGoogleLogin = async () => {
    const webClientId = Config.GOOGLE_WEB_CLIENT_ID?.trim?.();
    if (!webClientId) {
      Alert.alert(
        'Google login not configured',
        'Please set GOOGLE_WEB_CLIENT_ID in your .env file and rebuild the app.',
      );
      return;
    }

    try {
      setGoogleLoading(true);

      // iOS: Use Supabase OAuth PKCE flow to avoid native ID-token nonce issues.
      if (Platform.OS === 'ios') {
        oauthInFlightRef.current = true;
        if (oauthTimeoutRef.current) clearTimeout(oauthTimeoutRef.current);
        oauthTimeoutRef.current = setTimeout(() => {
          oauthInFlightRef.current = false;
          setGoogleLoading(false);
        }, 25000);

        const redirectTo = 'tenantmanager://auth';
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo,
            skipBrowserRedirect: true,
          },
        });

        if (error) {
          Alert.alert('Google login failed', error.message);
          return;
        }

        if (!data?.url) {
          Alert.alert('Google login failed', 'Missing authorization URL.');
          return;
        }

        // Force the auth URL to always use our native deep link redirect.
        // (Some RN URLSearchParams polyfills/types are inconsistent, so we avoid relying on `.set()`.)
        const forceRedirectTo = (url: string, to: string) => {
          const enc = encodeURIComponent(to);
          if (/[?&]redirect_to=/.test(url)) {
            return url.replace(/([?&]redirect_to=)[^&]*/i, `$1${enc}`);
          }
          return url + (url.includes('?') ? '&' : '?') + `redirect_to=${enc}`;
        };

        const authUrl = forceRedirectTo(data.url, redirectTo);

        // If the URL is still sending us to localhost, this is a Supabase Auth config issue.
        if (authUrl.includes('localhost') || authUrl.includes('127.0.0.1')) {
          Alert.alert(
            'Google login not configured',
            'Supabase is redirecting to localhost. In Supabase Dashboard → Auth → URL Configuration, add `tenantmanager://auth` to Redirect URLs and remove localhost from Site URL. Then rebuild and try again.',
          );
          return;
        }

        // Prefer in-app auth sheet on iOS (premium, in-app experience).
        if (await InAppBrowser.isAvailable()) {
          const res = await InAppBrowser.openAuth(authUrl, redirectTo, {
            // iOS
            ephemeralWebSession: false,
            // Android (not used here but keeps types happy)
            showTitle: false,
            enableUrlBarHiding: true,
            enableDefaultShare: false,
          });

          if (res.type === 'success' && res.url) {
            // Handle immediately (listener will also catch it on some devices).
            await handleSupabaseOAuthRedirect(res.url);
          } else if (res.type === 'cancel') {
            clearOauthTimer();
            setGoogleLoading(false);
          }
        } else {
          await Linking.openURL(authUrl);
        }
        return;
      }

      // Android: Native Google Sign-In → Supabase signInWithIdToken
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

      const result = await LoginWithGoogleIdToken(idToken);
      if (result.error) {
        Alert.alert('Google login failed', result.error.message);
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

      Alert.alert('Google login failed', e?.message ?? 'Please try again.');
    } finally {
      // For iOS OAuth we stop loading when callback arrives (or timeout triggers).
      if (Platform.OS !== 'ios' && !oauthInFlightRef.current) {
        setGoogleLoading(false);
      }
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
                  clearOauthTimer();
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
      </Surface>
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
});
