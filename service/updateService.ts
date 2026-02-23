/**
 * Hard Update Service
 * Manages version checking via Firebase Remote Config
 *
 * Firebase Remote Config Parameters:
 * - min_required_version: Minimum version user must have (e.g., "1.0.3")
 * - latest_version: Latest available version (e.g., "1.1.0")
 * - force_update_enabled: Whether to enforce hard updates (boolean)
 * - update_message: Custom message to show user (string)
 */

import remoteConfig from '@react-native-firebase/remote-config';
import DeviceInfo from 'react-native-device-info';
import { compareVersions, needsForceUpdate, hasOptionalUpdate } from '../Utility/versionUtils';

export type UpdateStatus = 'none' | 'optional' | 'force';

/**
 * Update check result object
 */
export interface UpdateCheckResult {
  status: UpdateStatus;
  currentVersion: string;
  minRequiredVersion: string;
  latestVersion: string;
  updateMessage: string;
  forceUpdateEnabled: boolean;
}

/**
 * Initialize Firebase Remote Config with sensible defaults
 */
const initializeRemoteConfig = async (): Promise<void> => {
  try {
    console.log('[UpdateService] Initializing Remote Config...');

    // Set config settings
    await remoteConfig().setConfigSettings({
      // Minimum fetch interval (0 for testing, 3600000 for production = 1 hour)
      minimumFetchIntervalMillis: __DEV__ ? 0 : 3600000,
    });

    // Set default values in case Remote Config is unavailable
    await remoteConfig().setDefaults({
      min_required_version: '1.0.0',
      latest_version: '1.0.0',
      force_update_enabled: false,
      update_message: 'A new version is available. Please update to continue using the app.',
    });

    console.log('[UpdateService] Remote Config initialized with defaults');
  } catch (error) {
    console.error('[UpdateService] Error initializing Remote Config:', error);
    throw error;
  }
};

/**
 * Fetch and activate the latest Remote Config values
 */
const fetchRemoteConfig = async (): Promise<void> => {
  try {
    console.log('[UpdateService] Fetching Remote Config...');
    await remoteConfig().fetchAndActivate();
    console.log('[UpdateService] Remote Config fetched and activated');
  } catch (error) {
    console.error('[UpdateService] Error fetching Remote Config:', error);
    //Don't throw - use defaults if fetch fails (offline scenario)
  }
};

/**
 * Get Remote Config values as strings
 *
 * NOTE: Using deprecated .asString() and .asBoolean() methods (React Native Firebase v22).
 * Deprecation warnings are suppressed via LogBox in App.tsx until migration to v23+ modular SDK.
 * TODO: Migrate to Firebase modular SDK when React Native Firebase v23+ is released.
 * See: https://rnfirebase.io/migrating-to-v22
 */
const getRemoteConfigValues = async (): Promise<{
  minRequiredVersion: string;
  latestVersion: string;
  updateMessage: string;
  forceUpdateEnabled: boolean;
}> => {
  try {
    const minRequired = remoteConfig()
      .getValue('tenant_manager_min_required_version')
      .asString();
    const latest = remoteConfig()
      .getValue('tenant_manager_latest_version')
      .asString();
    const message = remoteConfig()
      .getValue('tenant_manager_update_message')
      .asString();
    const forceEnabled = remoteConfig()
      .getValue('tenant_manager_force_update_enabled')
      .asBoolean();

    console.log('[UpdateService] Remote Config values:', {
      minRequired,
      latest,
      message: message.substring(0, 50) + '...',
      forceEnabled,
    });

    return {
      minRequiredVersion: minRequired,
      latestVersion: latest,
      updateMessage: message,
      forceUpdateEnabled: forceEnabled,
    };
  } catch (error) {
    console.error('[UpdateService] Error getting Remote Config values:', error);
    // Return defaults
    return {
      minRequiredVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateMessage: 'A new version is available. Please update to continue using the app.',
      forceUpdateEnabled: false,
    };
  }
};

/**
 * Main function: Check if app needs update
 * Call this at app startup (in App.tsx or AppNavigator)
 *
 * @returns UpdateCheckResult with status and version info
 */
export const checkForUpdate = async (): Promise<UpdateCheckResult> => {
  try {
    console.log('[UpdateService] Starting update check...');

    // Step 1: Initialize Remote Config
    await initializeRemoteConfig();

    // Step 2: Fetch latest config from Firebase
    await fetchRemoteConfig();

    // Step 3: Get current app version
    const currentVersion = DeviceInfo.getVersion();
    console.log('[UpdateService] Current app version:', currentVersion);

    // Step 4: Get Remote Config values
    const {
      minRequiredVersion,
      latestVersion,
      updateMessage,
      forceUpdateEnabled,
    } = await getRemoteConfigValues();

    // Step 5: Determine update status
    let status: UpdateStatus = 'none';

    // Check if force update is needed (current < minimum required)
    if (needsForceUpdate(currentVersion, minRequiredVersion)) {
      status = 'force';
      console.log('[UpdateService] ⛔ Force update required!');
    }
    // Check if optional update is available (current < latest)
    else if (hasOptionalUpdate(currentVersion, latestVersion) && forceUpdateEnabled) {
      status = 'optional';
      console.log('[UpdateService] ⬆️ Optional update available');
    }
    // App is up to date
    else {
      console.log('[UpdateService] ✅ App is up to date');
    }

    const result: UpdateCheckResult = {
      status,
      currentVersion,
      minRequiredVersion,
      latestVersion,
      updateMessage,
      forceUpdateEnabled,
    };

    console.log('[UpdateService] Update check result:', result);
    return result;
  } catch (error) {
    console.error('[UpdateService] Fatal error during update check:', error);
    // Return "none" to allow app to continue if check fails
    return {
      status: 'none',
      currentVersion: DeviceInfo.getVersion(),
      minRequiredVersion: '1.0.0',
      latestVersion: '1.0.0',
      updateMessage: '',
      forceUpdateEnabled: false,
    };
  }
};

/**
 * Get store URLs for opening app store
 */
export const getStoreUrl = (platform: 'ios' | 'android'): string => {
  if (platform === 'ios') {
    // Replace YOUR_APP_ID with actual Apple App Store ID
    return 'https://apps.apple.com/app/id1234567890';
  }
  // Android
  return 'https://play.google.com/store/apps/details?id=com.tenantmanager';
};
