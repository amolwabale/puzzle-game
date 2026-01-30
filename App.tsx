import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider, DefaultTheme as PaperDefaultTheme } from 'react-native-paper';
import { en, registerTranslation } from 'react-native-paper-dates';

import AppNavigator from './app/AppNavigator';

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
