export async function trackEvent(name: string, params?: Record<string, any>) {
  try {
    // dynamic require so builds don't fail if RN Firebase isn't linked
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const analyticsModule = require('@react-native-firebase/analytics');
    // Prefer modular API: exported `logEvent(analytics, name, params)` or `logEvent(name, params)`
    if (analyticsModule && typeof analyticsModule.logEvent === 'function') {
      try {
        // Some versions export modular `logEvent` that accepts (analytics, name, params)
        // Others accept (name, params). Try both.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const res = analyticsModule.logEvent(name, params ?? {});
        // If it returned a function or Promise, await if needed
        if (res && typeof res.then === 'function') await res;
      } catch (e) {
        // Fallback: call namespaced form if available
        const analytics = analyticsModule && analyticsModule.default ? analyticsModule.default : analyticsModule;
        if (analytics && typeof analytics === 'function' && typeof analytics().logEvent === 'function') {
          await analytics().logEvent(name, params ?? {});
        } else if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('analytics.logEvent exists but failed, and no namespaced fallback available', name, e);
        }
      }
    } else {
      // Namespaced fallback
      const analytics = analyticsModule && analyticsModule.default ? analyticsModule.default : analyticsModule;
      if (analytics && typeof analytics === 'function' && typeof analytics().logEvent === 'function') {
        await analytics().logEvent(name, params ?? {});
      } else {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('analytics module not available to log event', name);
        }
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
