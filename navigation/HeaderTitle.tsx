import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

export function HeaderTitle({
  icon,
  title,
  iconColor,
  titleColor,
}: {
  icon: string;
  title: string;
  iconColor?: string;
  titleColor?: string;
}) {
  const theme = useTheme();
  const ic = iconColor ?? theme.colors.primary;
  const tc = titleColor ?? theme.colors.onSurface;

  return (
    <View style={styles.row}>
      <MaterialCommunityIcons name={icon} size={18} color={ic} />
      <Text style={[styles.title, { color: tc }]} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: 260 },
  title: { fontWeight: '800', fontSize: 17 },
});

