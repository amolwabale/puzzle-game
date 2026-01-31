import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export function TopBackButton({ onPress, label }: { onPress: () => void; label: string }) {
  const theme = useTheme();

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel="Go back"
    >
      <View
  style={[
    styles.labelPill,
    {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primaryContainer,
    },
  ]}
>
  <View style={styles.iconTextRow}>
    <MaterialCommunityIcons
      name="chevron-left"
      size={20}
      color={theme.colors.primary}
    />

    <Text
      style={[styles.labelText, { color: theme.colors.primary }]}
      numberOfLines={1}
      ellipsizeMode="tail"
    >
      {label}
    </Text>
  </View>
</View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  hit: {
    height: 47,
    borderRadius: 999,
    marginLeft: 0,
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  circle: {
    width: 33,
    height: 33,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  labelPill: {
    marginLeft: 0,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    height: 33,
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 130,
  },
  labelText: {
    fontWeight: '900',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  iconTextRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4, // RN 0.71+, otherwise use marginRight
  },
});

