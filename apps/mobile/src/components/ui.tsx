import { useState, type PropsWithChildren } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type TextProps,
} from 'react-native';
import {
  colors,
  semanticColors,
  spacing,
  typography,
  border,
  radius,
} from '../design/tokens';
import { primaryTouchTarget } from '../accessibility/constants';

export function Copy({
  kind = 'body',
  style,
  ...props
}: TextProps & { kind?: 'title' | 'heading' | 'body' | 'label' }) {
  return (
    <Text
      {...props}
      style={[
        styles.text,
        typography[kind],
        (kind === 'title' || kind === 'heading') && styles.serif,
        style,
      ]}
    />
  );
}
export function Rule() {
  return <View style={styles.rule} accessible={false} />;
}
export function Eyebrow({ children }: PropsWithChildren) {
  return (
    <Copy kind="label" style={styles.eyebrow}>
      {children}
    </Copy>
  );
}
export function Button({
  label,
  onPress,
  primary = false,
  disabled = false,
  expanded,
  selected,
  hint,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  expanded?: boolean;
  selected?: boolean;
  hint?: string;
  /**
   * Overrides the spoken name only. Used where several controls share a short
   * visible label (for example two "Start" buttons) so screen reader users can
   * still tell them apart.
   */
  accessibilityLabel?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={hint}
      accessibilityState={{ disabled, expanded, selected }}
      style={({ pressed }) => [
        styles.button,
        primary && styles.primary,
        selected && styles.selected,
        focused && styles.focused,
        pressed && (primary ? styles.primaryPressed : styles.pressed),
        disabled && styles.disabled,
      ]}
    >
      <Copy
        kind="label"
        style={[styles.buttonText, primary && styles.primaryText]}
      >
        {label}
      </Copy>
    </Pressable>
  );
}
export const ui = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  section: { gap: spacing.lg },
  secondary: { color: colors.yale },
  input: {
    borderWidth: border.thin,
    borderColor: colors.yale,
    borderRadius: radius.sm,
    padding: spacing.lg,
    minHeight: 112,
    textAlignVertical: 'top',
    color: colors.ink,
    backgroundColor: colors.porcelain,
    ...typography.body,
  },
  message: { color: colors.yale, ...typography.label },
});
const styles = StyleSheet.create({
  text: { color: colors.ink, flexShrink: 1 },
  serif: { fontFamily: typography.family.editorial },
  eyebrow: {
    color: colors.yale,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  rule: {
    height: border.thin,
    backgroundColor: colors.yale,
    marginVertical: spacing.xl,
  },
  button: {
    ...primaryTouchTarget,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderWidth: border.thin,
    borderColor: colors.yale,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonText: { fontWeight: '600', textAlign: 'center' },
  primary: {
    backgroundColor: semanticColors.action,
    borderColor: semanticColors.action,
  },
  /** Pressed primary deepens to Ink rather than changing hue. */
  primaryPressed: {
    backgroundColor: semanticColors.actionPressed,
    borderColor: semanticColors.actionPressed,
  },
  primaryText: { color: semanticColors.onAction },
  selected: { backgroundColor: colors.powder, borderWidth: border.focus },
  focused: { outlineWidth: 3, outlineColor: colors.yale, outlineOffset: 3 },
  pressed: { borderWidth: 3 },
  disabled: { borderStyle: 'dashed' },
});
