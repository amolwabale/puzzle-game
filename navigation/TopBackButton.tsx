import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TouchableRipple, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export function TopBackButton({
  onPress,
  label,
  variant = 'pill',
}: {
  onPress: () => void;
  label: string;
  variant?: 'pill' | 'icon';
}) {
  const theme = useTheme();

  return (
    <TouchableRipple
      onPress={onPress}
      borderless
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel={label ? `Go back to ${label}` : 'Go back'}
    >
      <View
        style={[
          variant === 'icon' ? styles.circle : styles.labelPill,
          {
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primaryContainer,
          },
        ]}
      >
        <View style={styles.iconTextRow}>
          <MaterialCommunityIcons
            name="chevron-left"
            size={variant === 'icon' ? 22 : 20}
            color={theme.colors.primary}
          />

          {variant === 'pill' ? (
            <Text
              style={[styles.labelText, { color: theme.colors.primary }]}
              numberOfLines={1}
              ellipsizeMode="tail"
            >
              {label}
            </Text>
          ) : null}
        </View>
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  hit: {
    // Keep a stable hit-box for native-stack headers.
    width: 36,
    height: 36,
    borderRadius: 999,
    marginLeft: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
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
    gap: 2, // RN 0.71+, otherwise use marginRight
  },
});
