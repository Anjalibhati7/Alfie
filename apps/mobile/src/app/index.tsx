import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy } from '../components/ui';
import { colors, spacing } from '../design/tokens';
import { useSession, type Mode } from '../state/session';

/**
 * Home. Two ways in, nothing else competing. The layout is deliberately
 * asymmetrical: the hero carries the air, the modes sit low and quiet.
 */
export default function HomeScreen() {
  const { start, session } = useSession();

  function begin(mode: Mode) {
    start(mode);
    router.push('/session');
  }

  return (
    <Screen>
      <Copy kind="label" style={styles.wordmark}>
        Alfie
      </Copy>

      <View style={styles.hero}>
        <Copy kind="title" accessibilityRole="header" style={styles.headline}>
          Step out.{'\n'}Notice more.
        </Copy>
        <Copy style={styles.supporting}>
          A voice companion for noticing what’s around you.
        </Copy>
      </View>

      {session?.active ? (
        <View style={styles.modes}>
          <View style={styles.mode}>
            <Copy kind="heading">{session.mode} in progress</Copy>
            <Copy style={styles.line}>Pick up where you left off.</Copy>
            <Button
              label="Return"
              primary
              accessibilityLabel={`Return to your ${session.mode} session`}
              onPress={() => router.push('/session')}
            />
          </View>
        </View>
      ) : (
        <View style={styles.modes}>
          <View style={styles.mode}>
            <Copy kind="heading" accessibilityRole="header">
              Discover
            </Copy>
            <Copy style={styles.line}>Follow what catches your attention.</Copy>
            <Button
              label="Start"
              primary
              accessibilityLabel="Start a Discover session"
              hint="Opens the microphone and begins a spoken session. Location is optional."
              onPress={() => begin('Discover')}
            />
          </View>

          <View style={styles.mode}>
            <Copy kind="heading" accessibilityRole="header">
              Reimagine
            </Copy>
            <Copy style={styles.line}>See something familiar differently.</Copy>
            <Button
              label="Start"
              primary
              accessibilityLabel="Start a Reimagine session"
              hint="Opens the microphone and begins a spoken session. Location is optional."
              onPress={() => begin('Reimagine')}
            />
          </View>
        </View>
      )}

      <View style={styles.footer}>
        <Button
          label="Field Log"
          variant="quiet"
          accessibilityLabel="Open the Field Log"
          onPress={() => router.push('/field-log')}
        />
        <Copy kind="label" style={styles.micro}>
          Live voice · Location optional
        </Copy>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wordmark: { color: colors.ink, letterSpacing: 0.5 },
  hero: { marginTop: spacing.xxxl, gap: spacing.lg },
  headline: { color: colors.ink },
  supporting: { color: colors.yale },
  modes: {
    marginTop: spacing.xxxl,
    borderTopWidth: 1,
    borderTopColor: colors.powder,
  },
  mode: {
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.powder,
  },
  line: { color: colors.yale },
  footer: {
    marginTop: spacing.xxl,
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  micro: { color: colors.yale },
});
