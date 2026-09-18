import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy, Eyebrow, Rule, ui } from '../components/ui';
import { colors, spacing } from '../design/tokens';
import { useSession, type Mode } from '../state/session';

export default function HomeScreen() {
  const { start, session } = useSession();
  function begin(mode: Mode) {
    start(mode);
    router.push('/session');
  }
  return (
    <Screen>
      <View style={styles.masthead}>
        <Copy kind="heading">Alfie</Copy>
        <Eyebrow>Out of autopilot</Eyebrow>
      </View>
      <Rule />
      <View style={styles.intro}>
        <Eyebrow>A little more present</Eyebrow>
        <Copy kind="title" accessibilityRole="header">
          The world has{'\n'}more to it.
        </Copy>
        <Copy style={ui.secondary}>
          Follow what catches your attention.{'\n'}There’s no right way to
          begin.
        </Copy>
      </View>
      <View style={styles.preview}>
        <Copy kind="label">
          Live voice session · Microphone and optional location are used.
        </Copy>
      </View>
      {session?.active ? (
        <View style={ui.section}>
          <Copy>You have a {session.mode} session in progress.</Copy>
          <Button
            label="Return to session"
            primary
            onPress={() => router.push('/session')}
          />
        </View>
      ) : (
        <>
          <View style={styles.mode}>
            <Eyebrow>01 / Pay attention</Eyebrow>
            <Copy kind="heading" accessibilityRole="header">
              Discover
            </Copy>
            <Copy>
              Find a detail. Follow a question. Understand a little more of
              what’s around you.
            </Copy>
            <Button
              label="Begin Discover"
              primary
              onPress={() => begin('Discover')}
              hint="Opens a simulated session. No recording begins."
            />
          </View>
          <Rule />
          <View style={styles.mode}>
            <Eyebrow>02 / See it differently</Eyebrow>
            <Copy kind="heading" accessibilityRole="header">
              Reimagine
            </Copy>
            <Copy>
              Borrow from your surroundings. Change a rule, invent a use, or
              turn a detail into an idea.
            </Copy>
            <Button
              label="Begin Reimagine"
              primary
              onPress={() => begin('Reimagine')}
              hint="Opens a simulated session. No recording begins."
            />
          </View>
        </>
      )}
      <Rule />
      <Button
        label="Open Field Log"
        onPress={() => router.push('/field-log')}
      />
      <Copy kind="label" style={styles.footer}>
        Your pace. Your direction. Location is always optional.
      </Copy>
    </Screen>
  );
}
const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.md,
  },
  intro: { gap: spacing.lg },
  preview: {
    borderLeftWidth: 2,
    borderLeftColor: colors.yale,
    paddingLeft: spacing.md,
    marginVertical: spacing.xxl,
  },
  mode: { gap: spacing.lg },
  footer: { color: colors.yale, marginTop: spacing.xl },
});
