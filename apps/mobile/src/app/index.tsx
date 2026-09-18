import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy } from '../components/ui';
import { border, colors, radius, spacing } from '../design/tokens';
import { useSession, type Mode } from '../state/session';

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
        <Copy kind="title" accessibilityRole="header">
          Step out.{'\n'}Notice more.
        </Copy>
        <Copy style={styles.supporting}>
          A voice companion for noticing what’s around you.
        </Copy>
      </View>

      {session?.active ? (
        <View style={styles.modes}>
          <View style={styles.card}>
            <Copy kind="heading" accessibilityRole="header">
              {session.mode} in progress
            </Copy>
            <Copy style={styles.cardLine}>Pick up where you left off.</Copy>
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
          <View style={styles.card}>
            <Copy kind="heading" accessibilityRole="header">
              Discover
            </Copy>
            <Copy style={styles.cardLine}>
              Follow what catches your attention.
            </Copy>
            <Button
              label="Start"
              primary
              accessibilityLabel="Start a Discover session"
              hint="Opens the microphone and begins a spoken session. Location is optional."
              onPress={() => begin('Discover')}
            />
          </View>

          <View style={styles.card}>
            <Copy kind="heading" accessibilityRole="header">
              Reimagine
            </Copy>
            <Copy style={styles.cardLine}>
              See something familiar differently.
            </Copy>
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

      <View style={styles.bottom}>
        <Button
          label="Field Log"
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
  supporting: { color: colors.yale },
  modes: { marginTop: spacing.xxxl, gap: spacing.xl },
  card: {
    gap: spacing.lg,
    borderWidth: border.thin,
    borderColor: colors.powder,
    borderRadius: radius.sm,
    padding: spacing.xl,
  },
  cardLine: { color: colors.yale },
  bottom: { marginTop: spacing.xxxl, gap: spacing.lg },
  micro: { color: colors.yale },
});
