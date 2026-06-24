import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SlidingPuzzle from './components/SlidingPuzzle';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <SlidingPuzzle />
    </SafeAreaProvider>
  );
}
