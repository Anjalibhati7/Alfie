import { StyleSheet, Text, View } from 'react-native';
import { Screen } from '../components/Screen';
import { border, semanticColors, spacing, typography } from '../design/tokens';

export default function BootScreen() {
  return (
    <Screen>
      <Text accessibilityRole="header" style={styles.title}>
        Alfie
      </Text>
      <View accessible={false} style={styles.rule} />
      <Text style={styles.status}>Alfie is ready.</Text>
      <Text style={styles.note}>A little more present.</Text>
    </Screen>
  );
}
const styles = StyleSheet.create({
  title: {
    ...typography.title,
    fontFamily: typography.family.editorial,
    color: semanticColors.text,
  },
  rule: {
    height: border.thin,
    backgroundColor: semanticColors.divider,
    marginVertical: spacing.xl,
  },
  status: { ...typography.body, color: semanticColors.text },
  note: {
    ...typography.body,
    color: semanticColors.secondaryText,
    marginTop: spacing.sm,
  },
});
