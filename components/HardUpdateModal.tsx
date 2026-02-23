/**
 * Hard Update Modal Component
 * Shows blocking modal when app update is required or available
 *
 * Features:
 * - Force update: Cannot dismiss, must update to use app
 * - Optional update: Can dismiss and continue
 * - Custom styling with Material Design 3 theme
 * - Opens app store on button tap
 */

import React from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Linking,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { Button, Text, useTheme, Icon, Portal, Surface } from 'react-native-paper';
import { trackEvent } from '../service/analyticsTracker';

interface HardUpdateModalProps {
  visible: boolean;
  isForceUpdate: boolean;
  message: string;
  storeUrl: string;
  onOptionalDismiss?: () => void;
}

/**
 * HardUpdateModal Component
 *
 * For force updates: Shows blocking modal that cannot be dismissed
 * For optional updates: Shows modal with "Later" button
 *
 * @param visible - Whether modal is shown
 * @param isForceUpdate - If true, force update (no dismiss button)
 * @param message - Custom message from Remote Config
 * @param storeUrl - URL to open store
 * @param onOptionalDismiss - Callback for optional update dismiss
 */
export const HardUpdateModal: React.FC<HardUpdateModalProps> = ({
  visible,
  isForceUpdate,
  message,
  storeUrl,
  onOptionalDismiss,
}) => {
  const theme = useTheme();

  const handleOpenStore = React.useCallback(async () => {
    try {
      console.log('[HardUpdateModal] Opening store:', storeUrl);
      trackEvent('HardUpdate_OpenStore', {
        platform: Platform.OS,
      });

      const canOpen = await Linking.canOpenURL(storeUrl);
      if (canOpen) {
        await Linking.openURL(storeUrl);
      } else {
        console.error('[HardUpdateModal] Cannot open store URL:', storeUrl);
      }
    } catch (error) {
      console.error('[HardUpdateModal] Error opening store:', error);
    }
  }, [storeUrl]);

  const handleDismiss = React.useCallback(() => {
    if (!isForceUpdate && onOptionalDismiss) {
      console.log('[HardUpdateModal] Dismissing optional update');
      trackEvent('HardUpdate_SkipOptional', {});
      onOptionalDismiss();
    }
  }, [isForceUpdate, onOptionalDismiss]);

  return (
    <Portal>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        hardwareAccelerated
        // Force update cannot be dismissed by back button or swipe
        onRequestClose={isForceUpdate ? () => {} : handleDismiss}
      >
        <View
          style={[
            styles.overlay,
            {
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
            },
          ]}
        >
          <Surface
            style={[
              styles.container,
              {
                backgroundColor: theme.colors.surface,
              },
            ]}
            elevation={4}
          >
            {/* Header Icon */}
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isForceUpdate
                    ? theme.colors.error
                    : theme.colors.primary,
                },
              ]}
            >
              <Icon
                source={isForceUpdate ? 'alert-circle' : 'cloud-download'}
                size={56}
                color="white"
              />
            </View>

            {/* Title */}
            <Text
              variant="headlineSmall"
              style={[
                styles.title,
                {
                  color: isForceUpdate ? theme.colors.error : theme.colors.primary,
                  marginTop: 20,
                },
              ]}
            >
              {isForceUpdate ? 'Update Required' : 'Update Available'}
            </Text>

            {/* Message */}
            <Text
              variant="bodyMedium"
              style={[
                styles.message,
                {
                  color: theme.colors.onSurface,
                },
              ]}
            >
              {message}
            </Text>

            {/* Additional info for force update */}
            {isForceUpdate && (
              <Text
                variant="labelSmall"
                style={[
                  styles.subtext,
                  {
                    color: theme.colors.onSurfaceVariant,
                  },
                ]}
              >
                You need to update the app to continue using it.
              </Text>
            )}

            {/* Button Container */}
            <View style={styles.buttonContainer}>
              {/* Update Button (Always shown) */}
              <Button
                mode="contained"
                onPress={handleOpenStore}
                style={styles.updateButton}
                labelStyle={{
                  fontSize: 16,
                  fontWeight: '600' as const,
                }}
                icon="cloud-download"
              >
                Update Now
              </Button>

              {/* Later Button (Optional update only) */}
              {!isForceUpdate && (
                <Button
                  mode="outlined"
                  onPress={handleDismiss}
                  style={styles.laterButton}
                  labelStyle={{
                    fontSize: 14,
                    fontWeight: '600' as const,
                  }}
                >
                  Later
                </Button>
              )}
            </View>

            {/* Footer message */}
            <Text
              variant="labelSmall"
              style={[
                styles.footerText,
                {
                  color: theme.colors.onSurfaceVariant,
                },
              ]}
            >
              {Platform.OS === 'ios' ? 'Available on App Store' : 'Available on Google Play'}
            </Text>
          </Surface>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  container: {
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 24,
    alignItems: 'center',
    maxWidth: 420,
    width: '100%',
  },
  iconContainer: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -44, // Half of height to overlap with modal
  },
  title: {
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 22,
  },
  subtext: {
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 18,
    marginHorizontal: 4,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
    marginTop: 8,
  },
  updateButton: {
    marginVertical: 0,
    paddingVertical: 2,
  },
  laterButton: {
    marginVertical: 0,
    paddingVertical: 2,
  },
  footerText: {
    marginTop: 16,
    textAlign: 'center',
  },
});
