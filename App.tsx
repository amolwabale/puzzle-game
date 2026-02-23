import { StatusBar, LogBox } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Provider as PaperProvider,
  DefaultTheme as PaperDefaultTheme,
} from 'react-native-paper';
import { en, registerTranslation } from 'react-native-paper-dates';

import AppNavigator from './app/AppNavigator';

/**
 * Suppress React Native Firebase v22+ deprecation warnings
 * These warnings are about the namespaced API which will be removed in v23+
 * Migration to the new modular SDK will happen in a future version
 * See: https://rnfirebase.io/migrating-to-v22
 */
LogBox.ignoreLogs([
  'This method is deprecated (as well as all React Native Firebase namespaced API)',
]);

// Register locales once for react-native-paper-dates
registerTranslation('en', en);

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={PaperDefaultTheme}>
        <StatusBar barStyle="dark-content" />
        <AppNavigator />
      </PaperProvider>
    </SafeAreaProvider>
  );
}
