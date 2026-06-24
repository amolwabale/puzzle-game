import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SlidingPuzzle from './components/SlidingPuzzle';
import {useEffect} from 'react';
import {trackEvent} from './service/analyticsTracker';

export default function App() {
  useEffect(() => {
    void trackEvent('app_start');
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SlidingPuzzle />
    </SafeAreaProvider>
  );
}
