import React from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { Avatar, Button, Surface, Text, useTheme } from 'react-native-paper';
import { changePasswordAndLogout } from '../../service/MenuService';
import { FormInput } from '../../components/FormInput';
import { trackEvent } from '../../service/analyticsTracker';

export default function ChangePasswordScreen() {
  const theme = useTheme();
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<{
    password?: string;
    confirmPassword?: string;
  }>({});

  const validate = React.useCallback(() => {
    const next: { password?: string; confirmPassword?: string } = {};
    if (!password) next.password = 'Required';
    else if (password.length < 6)
      next.password = 'Minimum 6 characters required';
    if (!confirmPassword) next.confirmPassword = 'Required';
    else if (password !== confirmPassword)
      next.confirmPassword = 'Passwords do not match';
    setErrors(next);
    return Object.keys(next).length === 0;
  }, [password, confirmPassword]);

  const onSave = React.useCallback(async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await changePasswordAndLogout(password);
      Alert.alert(
        'Password changed',
        'Please login again with your new password.',
      );
      trackEvent('Password_Changed', {
        source: 'Menu',
        password_id: password,
      });
      // AppNavigator will redirect to AuthStack after signOut.
    } catch (e: any) {
      Alert.alert('Failed', e?.message || 'Could not change password.');
    } finally {
      setSaving(false);
    }
  }, [password, validate]);

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* HERO */}
        <Surface style={styles.hero} elevation={2}>
          <View
            style={[
              styles.heroIconWrap,
              { backgroundColor: theme.colors.primaryContainer },
            ]}
          >
            <Avatar.Icon
              size={46}
              icon="lock-reset"
              style={{ backgroundColor: 'transparent' }}
              color={theme.colors.primary}
            />
          </View>
          <View style={styles.heroText}>
            <Text variant="titleLarge" style={styles.heroTitle}>
              Change password
            </Text>
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              Update password and sign out securely
            </Text>
          </View>
        </Surface>

        {/* FORM */}
        <Surface style={styles.section} elevation={2}>
          <Text variant="titleMedium" style={styles.sectionTitle}>
            New password
          </Text>

          <View>
            {/* As requested: show typed characters (not masked) */}

            <FormInput
              label="New password *"
              value={password}
              error={errors.password}
              onChange={t => setPassword(t)}
              secureTextEntry={false}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              maxLength={64}
            />
          </View>

          <View>
            {/* As requested: show as stars */}
            <FormInput
              label="Confirm password *"
              value={confirmPassword}
              error={errors.confirmPassword}
              onChange={t => setConfirmPassword(t)}
              secureTextEntry={true}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              autoComplete="password-new"
              maxLength={64}
              multiline={false}
            />
          </View>

          <Button
            mode="contained"
            onPress={() => void onSave()}
            disabled={saving}
            loading={saving}
            style={styles.primaryButton}
          >
            Change password
          </Button>
        </Surface>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 12, paddingBottom: 20 },
  hero: {
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: '#FFFFFF',
  },
  heroIconWrap: { borderRadius: 14, overflow: 'hidden' },
  heroText: { flex: 1, marginLeft: 12, minWidth: 0 },
  heroTitle: { fontWeight: '800', fontSize: 20, color: '#111827' },
  heroSubtitle: {
    color: '#6B7280',
    marginTop: 2,
    fontSize: 13,
    fontWeight: '700',
  },

  section: { borderRadius: 16, padding: 12, backgroundColor: '#FFFFFF' },
  sectionTitle: {
    fontWeight: '800',
    marginBottom: 8,
    fontSize: 16,
    color: '#111827',
  },
  field: { marginBottom: 8 },
  // Critical: keep fontSize/lineHeight consistent so the outlined container always contains the glyphs.
  // This prevents rare blur/layout reflows where text can wrap and visually paint outside the outline.
  input: { minHeight: 48 },
  inputContent: { paddingVertical: 8, fontSize: 16, lineHeight: 20 },
  helper: { marginTop: 0, paddingVertical: 2 },
  primaryButton: { marginTop: 4 },
});
