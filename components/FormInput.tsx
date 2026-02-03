import React from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';
import { HelperText, TextInput, useTheme } from 'react-native-paper';

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  keyboard?: any;
  multiline?: boolean;
  maxLength?: number;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  textContentType?: any;
  autoComplete?: any;
  /** Optional: pass a style used for the TextInput wrapper */
  style?: StyleProp<ViewStyle>;
  /** Optional: pass a style used for the TextInput content */
  contentStyle?: StyleProp<TextStyle>;
  /** Optional: pass a placeholder for the TextInput */
  placeholder?: string;
};

/**
 * Shared form input for this app.
 * - Single-line inputs: never wrap on blur (sanitize newlines), horizontal scroll.
 * - Multiline inputs: stable 4-line textarea (no auto-height flicker).
 * - MD3 font metrics aligned with contentStyle to avoid outline/layout glitches.
 */
export function FormInput({
  label,
  value,
  onChange,
  error,
  keyboard,
  multiline,
  maxLength,
  secureTextEntry,
  autoCapitalize,
  autoCorrect,
  textContentType,
  autoComplete,
  style,
  contentStyle,
  placeholder,
}: Props) {
  const theme = useTheme();

  const inputTheme = React.useMemo(
    () =>
      ({
        ...theme,
        fonts: {
          ...(theme as any).fonts,
          labelLarge: {
            ...(theme as any).fonts?.labelLarge,
            fontSize: 14,
            lineHeight: 18,
          },
          bodyLarge: {
            ...(theme as any).fonts?.bodyLarge,
            fontSize: 16,
            lineHeight: 20,
          },
        },
      } as any),
    [theme],
  );

  const sanitizeSingleLine = React.useCallback(
    (t: string) => t.replace(/[\r\n]+/g, ' '),
    [],
  );

  // Stable 4-line textarea height (prevents per-keystroke layout reflow/flicker).
  const lineHeight = 20;
  const textPadY = 10;
  const stableMultilineHeight = lineHeight * 4 + textPadY * 2 + 24; // text + padding + outline/label buffer

  const baseContentStyle: StyleProp<TextStyle> = [
    styles.content,
    contentStyle,
    Platform.OS === 'android' ? ({ includeFontPadding: false } as any) : null,
  ];

  return (
    <>
      <View style={styles.marginBottom}>
        <TextInput
          label={label}
          value={String(value ?? '')}
          onChangeText={t => {
            if (multiline) onChange(String(t ?? '').replace(/\r/g, ''));
            else onChange(sanitizeSingleLine(String(t ?? '')));
          }}
          mode="outlined"
          keyboardType={keyboard}
          dense={!multiline}
          multiline={!!multiline}
          maxLength={maxLength}
          placeholder={placeholder}
          secureTextEntry={!!secureTextEntry}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          textContentType={textContentType}
          autoComplete={autoComplete}
          {...(multiline
            ? {
                numberOfLines: 4,
                scrollEnabled: true,
                style: [styles.input, { height: stableMultilineHeight }, style],
                contentStyle: [
                  ...(baseContentStyle as any),
                  {
                    textAlignVertical: 'top' as any,
                    lineHeight,
                    paddingVertical: textPadY,
                  },
                ],
              }
            : {
                numberOfLines: 1,
                scrollEnabled: true,
                style: [styles.input, { height: 48 }, style],
                contentStyle: [
                  styles.singleLineContent,
                  contentStyle,
                  Platform.OS === 'android'
                    ? ({ includeFontPadding: false } as any)
                    : null,
                ],
              })}
          theme={inputTheme}
          error={!!error}
        />
        {error ? (
          <HelperText type="error" visible style={styles.helper}>
            {error}
          </HelperText>
        ) : null}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  input: { marginBottom: 0 },
  marginBottom: { marginBottom: 12 },
  content: { fontSize: 16, lineHeight: 20, paddingVertical: 8 },
  helper: { fontSize: 12, paddingVertical: 2, marginBottom: -12 },
  singleLineContent: {
    paddingVertical: 0,
    paddingHorizontal: 12,
    textAlignVertical: 'center',
    fontSize: 16,
  },
});
