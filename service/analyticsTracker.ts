export async function trackEvent(name: string, params?: Record<string, any>) {
  try {
    // dynamic require so builds don't fail if RN Firebase isn't linked
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const analyticsModule = require('@react-native-firebase/analytics');
    const analytics = analyticsModule && analyticsModule.default ? analyticsModule.default : analyticsModule;
    if (analytics && typeof analytics === 'function') {
      await analytics().logEvent(name, params ?? {});
    } else {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        // eslint-disable-next-line no-console
        console.warn('analytics module not available to log event', name);
      }
    }
  } catch (e) {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('trackEvent exception', name, e);
    }
    // analytics not available or failed — swallow silently
  }
}

export default { trackEvent };
