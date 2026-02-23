/**
 * Version Comparison Utilities
 * Handles semantic version comparisons for hard update checks
 */

/**
 * Compare two semantic versions (e.g., "1.0.3" vs "1.0.4")
 * @param v1 Current version
 * @param v2 Version to compare against
 * @returns
 *  -1 if v1 < v2 (current version is older)
 *   0 if v1 = v2 (versions are equal)
 *   1 if v1 > v2 (current version is newer)
 */
export const compareVersions = (v1: string, v2: string): number => {
  try {
    const s1 = v1.split('.').map((num) => parseInt(num, 10));
    const s2 = v2.split('.').map((num) => parseInt(num, 10));

    // Pad shorter version with zeros
    const maxLen = Math.max(s1.length, s2.length);
    while (s1.length < maxLen) s1.push(0);
    while (s2.length < maxLen) s2.push(0);

    // Compare each segment
    for (let i = 0; i < maxLen; i++) {
      const num1 = s1[i] || 0;
      const num2 = s2[i] || 0;

      if (num1 > num2) return 1;  // v1 is newer
      if (num1 < num2) return -1; // v1 is older
    }

    return 0; // Equal
  } catch (error) {
    console.error('[VersionUtils] Error comparing versions:', error);
    return 0;
  }
};

/**
 * Check if current version needs force update
 * @param currentVersion Current app version
 * @param minRequiredVersion Minimum required version from Remote Config
 * @returns true if force update is needed
 */
export const needsForceUpdate = (
  currentVersion: string,
  minRequiredVersion: string,
): boolean => {
  return compareVersions(currentVersion, minRequiredVersion) < 0;
};

/**
 * Check if optional update is available
 * @param currentVersion Current app version
 * @param latestVersion Latest available version from Remote Config
 * @returns true if optional update is available
 */
export const hasOptionalUpdate = (
  currentVersion: string,
  latestVersion: string,
): boolean => {
  return compareVersions(currentVersion, latestVersion) < 0;
};

/**
 * Log version information for debugging
 */
export const logVersionInfo = (
  currentVersion: string,
  minRequired: string,
  latest: string,
): void => {
  console.log('[VersionUtils] Version Info:', {
    current: currentVersion,
    minRequired,
    latest,
    isOutdated: compareVersions(currentVersion, minRequired) < 0,
    updateAvailable: compareVersions(currentVersion, latest) < 0,
  });
};
