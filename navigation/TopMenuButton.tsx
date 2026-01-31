import React from 'react';
import { StyleSheet, View } from 'react-native';
import { TouchableRipple, useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTopMenu } from './TopMenuDrawer';

export function TopMenuButton() {
  const { openMenu } = useTopMenu();
  const theme = useTheme();

  return (
    <TouchableRipple
      onPress={openMenu}
      borderless
      style={styles.hit}
      accessibilityRole="button"
      accessibilityLabel="Open menu"
    >
      <View
        style={[
          styles.circle,
          {
            borderColor: theme.colors.primary,
            backgroundColor: theme.colors.primaryContainer,
          },
        ]}
      >
        <MaterialCommunityIcons name="menu" size={22} color={theme.colors.primary} />
      </View>
    </TouchableRipple>
  );
}

const styles = StyleSheet.create({
  hit: {
    borderRadius: 999,
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
});

