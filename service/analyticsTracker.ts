import { getApp } from '@react-native-firebase/app';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';

const analyticsInstance = getAnalytics(getApp());

export const trackScreen = async (name: string) => {
  try {
    logEvent(analyticsInstance, 'screen_view', {
      firebase_screen: name,
      firebase_screen_class: name,
    });
  } catch (e) {
    // fail silently in prod
    console.log('Analytics error:', e);
  }
};

export const trackEvent = async (
  name: string,
  params: Record<string, string | number | boolean | undefined>,
) => {
  try {
    logEvent(analyticsInstance, name, params);
  } catch (e) {
    // fail silently in prod
    console.log('Analytics error:', e);
  }
};
