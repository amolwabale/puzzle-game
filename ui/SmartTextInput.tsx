import React from 'react';
import { Platform, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { TextInput, useTheme } from 'react-native-paper';

type Props = {
  label?: string;
  value: string;
  onChangeText: (t: string) => void;
  error?: boolean;
  keyboardType?: any;
  multiline?: boolean;
  dense?: boolean;
  /** For multiline: grow up to this many lines, then scroll internally */
  maxLines?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<TextStyle>;
  right?: React.ReactNode;
  left?: React.ReactNode;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  returnKeyType?: any;
  onSubmitEditing?: () => void;
  editable?: boolean;
  disabled?: boolean;
};

/**
 * SmartTextInput
 * Root-cause fix for outlined TextInput overflow:
 * - For single-line fields: explicitly force single-line (no wrapping) and stable minHeight.
 * - For multiline fields: auto-grow height with content (no clipping/spill outside outline),
 *   and only enable internal scrolling after a max height.
 * - Align lineHeight + padding with the underlying font metrics to avoid "blur wrap" glitches.
 */
export function SmartTextInput({
  label,
  value,
  onChangeText,
  error,
  keyboardType,
  multiline = false,
  dense = true,
  maxLines = 5,
  style,
  contentStyle,
  right,
  left,
  placeholder,
  secureTextEntry,
  autoCapitalize = 'none',
  autoCorrect = false,
  returnKeyType,
  onSubmitEditing,
  editable,
  disabled,
}: Props) {
  const theme = useTheme();

  const lineHeight = 20;
  const fontSize = 16;
  const verticalPad = multiline ? 10 : 8;

  const minHeight = multiline ? 120 : 48;
  const maxHeight = multiline ? Math.max(minHeight, maxLines * lineHeight + verticalPad * 2 + 20) : minHeight;

  const [measuredHeight, setMeasuredHeight] = React.useState<number | undefined>(undefined);
  const height = multiline ? Math.min(maxHeight, Math.max(minHeight, measuredHeight || minHeight)) : undefined;
  // Some platform combos can paint text outside bounds when scrolling is disabled.
  // Keep scrolling enabled for multiline; height determines whether it "feels" like it scrolls.
  const scrollEnabled = multiline;

  const mergedContentStyle: StyleProp<TextStyle> = [
    {
      fontSize,
      lineHeight,
      paddingVertical: verticalPad,
      // Android-specific: prevents extra font padding that can cause text to render outside outline.
      ...(Platform.OS === 'android' ? ({ includeFontPadding: false } as any) : null),
      textAlignVertical: multiline ? 'top' : 'center',
    },
    contentStyle,
  ];

  // Keep Paper's theme, but ensure font metrics align with contentStyle.
  const inputTheme = React.useMemo(
    () =>
      ({
        ...theme,
        fonts: {
          ...(theme as any).fonts,
          labelLarge: { ...(theme as any).fonts?.labelLarge, fontSize: 14, lineHeight: 18 },
          bodyLarge: { ...(theme as any).fonts?.bodyLarge, fontSize, lineHeight },
        },
      }) as any,
    [theme],
  );

  return (
    <TextInput
      {...(label ? { label } : null)}
      value={value}
      onChangeText={onChangeText}
      mode="outlined"
      keyboardType={keyboardType}
      multiline={multiline}
      numberOfLines={multiline ? maxLines : 1}
      dense={dense}
      style={[
        { minHeight: multiline ? height : minHeight },
        multiline && height ? { height } : null,
        // Ensure the native text layer never paints outside the outline box.
        multiline ? ({ overflow: 'hidden' } as any) : null,
        style,
      ]}
      contentStyle={mergedContentStyle}
      theme={inputTheme}
      error={!!error}
      scrollEnabled={scrollEnabled}
      right={right as any}
      left={left as any}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      returnKeyType={returnKeyType}
      onSubmitEditing={onSubmitEditing}
      editable={editable}
      disabled={disabled}
      // Measure content height to auto-grow multiline (prevents border overflow).
      onContentSizeChange={(e) => {
        if (!multiline) return;
        const h = e?.nativeEvent?.contentSize?.height;
        if (typeof h === 'number' && Number.isFinite(h)) setMeasuredHeight(h + verticalPad * 2);
      }}
    />
  );
}

