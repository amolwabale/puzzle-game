export async function trackEvent(name: string, params?: Record<string, any>) {
  try {
    if (typeof __DEV__ !== 'undefined' && __DEV__) {
      // eslint-disable-next-line no-console
      console.log('[analytics] trackEvent called', name, params);
    }
    // dynamic require so builds don't fail if RN Firebase isn't linked
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const analyticsModule = require('@react-native-firebase/analytics');

    // Prefer the modular API: logEvent(getAnalytics(), name, params)
    try {
      // also try to resolve getAnalytics from the core app package
      let getAnalytics = analyticsModule.getAnalytics ?? analyticsModule.getAppAnalytics ?? null;
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const appModule = require('@react-native-firebase/app');
        getAnalytics = getAnalytics ?? (appModule && (appModule.getAnalytics ?? appModule.getAppAnalytics)) ?? getAnalytics;
      } catch (e) {
        // ignore if app module not present
      }
      if (typeof analyticsModule.logEvent === 'function' && typeof getAnalytics === 'function') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const analyticsInstance = getAnalytics();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const res = analyticsModule.logEvent(analyticsInstance, name, params ?? {});
          if (res && typeof res.then === 'function') await res;
          if (typeof __DEV__ !== 'undefined' && __DEV__) {
            // eslint-disable-next-line no-console
            console.log('[analytics] used modular logEvent with instance', name);
          }
          return;
        } catch (e) {
          // fall through to other strategies
        }
      }
    } catch (e) {
      // ignore
    }

    // Fallback to instance-based API (namespaced): analytics() -> instance.logEvent
    try {
      // resolve factory (module.default interoperability)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const factory: any = analyticsModule && analyticsModule.default ? analyticsModule.default : analyticsModule;
      if (typeof factory === 'function') {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          const instance = factory();
          if (instance && typeof instance.logEvent === 'function') {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-call
            await instance.logEvent(name, params ?? {});
            if (typeof __DEV__ !== 'undefined' && __DEV__) {
              // eslint-disable-next-line no-console
              console.warn('analytics: used namespaced logEvent; migrate to modular API to avoid deprecation');
            }
            return;
          }
        } catch (e) {
          // fallthrough
        }
      }
    } catch (e) {
      // ignore
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
    // swallow in production
  }
}

export default { trackEvent };
