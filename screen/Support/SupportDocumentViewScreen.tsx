import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Text } from 'react-native-paper';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { WebView } from 'react-native-webview';
import { SupportStackParamList } from '../../navigation/StackParam';

type Props = NativeStackScreenProps<SupportStackParamList, 'SupportDocument'>;

export default function SupportDocumentViewScreen({ route }: Props) {
  const { url } = route.params;

  const isPdf = /\.pdf(\?|#|$)/i.test(String(url).split('?')[0] ?? '');
  const viewerUrl =
    Platform.OS === 'android' && isPdf
      ? `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(
          url,
        )}`
      : url;

  const zoomViewportScript = `
    (function() {
      var meta = document.querySelector('meta[name=viewport]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
      }
      meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes';
    })();
    true;
  `;

  return (
    <View style={styles.container}>
      <WebView
        source={{ uri: viewerUrl }}
        startInLoadingState
        scalesPageToFit
        javaScriptEnabled
        domStorageEnabled
        setBuiltInZoomControls={Platform.OS === 'android'}
        setDisplayZoomControls={false}
        scrollEnabled
        injectedJavaScript={zoomViewportScript}
        renderLoading={() => (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" />
          </View>
        )}
        renderError={() => (
          <View style={styles.loaderOverlay}>
            <Text>Unable to load document.</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
});
