export async function trackEvent(name: string, params?: Record<string, any>) {
  try {
    // dynamic require so builds don't fail if RN Firebase isn't linked
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
    const analytics = require('@react-native-firebase/analytics').default;
    if (analytics && typeof analytics === 'function') {
      await analytics().logEvent(name, params ?? {});
    }
  } catch (e) {
    // analytics not available or failed — swallow silently
  }
}

export default { trackEvent };
