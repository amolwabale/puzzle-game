import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Provider as PaperProvider,
  DefaultTheme as PaperDefaultTheme,
} from 'react-native-paper';
import { en, registerTranslation } from 'react-native-paper-dates';
import { QueryClientProvider } from '@tanstack/react-query';

import AppNavigator from './app/AppNavigator';
import { queryClient } from './app/queryClient';

// Register locales once for react-native-paper-dates
registerTranslation('en', en);

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <PaperProvider theme={PaperDefaultTheme}>
          <StatusBar barStyle="dark-content" />
          <AppNavigator />
        </PaperProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
