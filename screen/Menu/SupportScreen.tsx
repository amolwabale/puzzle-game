import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { FAB, Icon, Surface, Text, useTheme } from 'react-native-paper';

export default function SupportScreen() {
  const theme = useTheme();
  const navigation = useNavigation<any>();
  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Surface style={styles.card} elevation={1}>
          <View style={[styles.iconWrap, { backgroundColor: theme.colors.primaryContainer }]}>
            <Icon source="lifebuoy" size={24} color={theme.colors.primary} />
          </View>
          <Text style={styles.title}>Support</Text>
          <Text style={styles.sub}>Coming soon.</Text>
        </Surface>
      </ScrollView>

      <FAB
        icon="home"
        style={styles.fab}
        onPress={() => navigation.navigate('MainTabs', { screen: 'Dashboard' })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6FA' },
  content: { padding: 16, paddingBottom: 24 },
  card: { borderRadius: 18, padding: 16, backgroundColor: '#FFFFFF' },
  iconWrap: { width: 44, height: 44, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 12, fontWeight: '900', fontSize: 18, color: '#111827' },
  sub: { marginTop: 4, color: '#6B7280', fontWeight: '700' },
  fab: { position: 'absolute', right: 16, bottom: 24 },
});

