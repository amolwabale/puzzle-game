export async function trackEvent(name: string, params?: Record<string, any>) {
  try {
    // dynamic require so builds don't fail if RN Firebase isn't linked
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const analyticsModule = require('@react-native-firebase/analytics');
    // Prefer modular API when available.
    if (analyticsModule && typeof analyticsModule.logEvent === 'function') {
      // If modular exports getAnalytics, prefer passing an analytics instance
      try {
        // Try: logEvent(getAnalytics(), name, params)
        const getAnalytics = analyticsModule.getAnalytics ?? analyticsModule.getAppAnalytics ?? null;
        if (typeof getAnalytics === 'function') {
          try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const analyticsInstance = getAnalytics();
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const res = analyticsModule.logEvent(analyticsInstance, name, params ?? {});
            if (res && typeof res.then === 'function') await res;
            return;
          } catch (e) {
            // fallthrough to other signatures
          }
        }

        // If logEvent expects (name, params)
        if (analyticsModule.logEvent.length <= 2) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const res = analyticsModule.logEvent(name, params ?? {});
          if (res && typeof res.then === 'function') await res;
          return;
        }

        // As a last resort, try calling with (analytics, name, params) using default export to get instance
        const analyticsDefault = analyticsModule && analyticsModule.default ? analyticsModule.default : analyticsModule;
        if (typeof analyticsDefault === 'function') {
          const instance = analyticsDefault();
          if (instance && typeof analyticsModule.logEvent === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            const res = analyticsModule.logEvent(instance, name, params ?? {});
            if (res && typeof res.then === 'function') await res;
            return;
          }
        }
      } catch (e) {
        if (typeof __DEV__ !== 'undefined' && __DEV__) {
          // eslint-disable-next-line no-console
          console.warn('analytics.logEvent modular call failed, will try namespaced fallback', e);
        }
      }
    }

    // Namespaced fallback: analytics() -> { logEvent }
    try {
      const analyticsNs = (analyticsModule && analyticsModule.default) ? analyticsModule.default : analyticsModule;
      if (analyticsNs && typeof analyticsNs === 'function') {
        const instance = analyticsNs();
        if (instance && typeof instance.logEvent === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          await instance.logEvent(name, params ?? {});
          return;
        }
      }
    } catch (e) {
      // fall through to dev warning below
    }

    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.warn('analytics module not available to log event', name);
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
