
import analytics from '@react-native-firebase/analytics';

export const trackScreen = async (name: string) => {
  try {
    await analytics().logScreenView({
      screen_name: name,
      screen_class: name,
    });
  } catch (e) {
    // fail silently in prod
    console.log('Analytics error:', e);
  }
};