import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button, Copy, ui } from '../../components/ui';
import { colors, spacing } from '../../design/tokens';
import { useSession } from '../../state/session';
import {
  durationLabel,
  relativeDayLabel,
  type JournalSession,
} from '../../services/journal/storage';

/**
 * The Field Log is a memory of the outing, not a record of the conversation.
 * Each card opens the session it describes; no card ever starts a new session.
 */
function SessionCard({ session }: { session: JournalSession }) {
  const place = session.placeLabel ?? 'Walk';
  const themes = session.themes.slice(0, 3).join(' · ');
  const summary = `${relativeDayLabel(session.startedAt)}, ${place}. ${session.mode}, ${durationLabel(session.durationMs)}.${
    themes ? ` Themes: ${themes}.` : ''
  }`;

  return (
    <Pressable
      onPress={() => router.push(`/field-log/${session.id}`)}
      accessibilityRole="button"
      accessibilityLabel={summary}
      accessibilityHint="Opens this session"
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <Copy kind="label" style={ui.secondary}>
        {relativeDayLabel(session.startedAt)} · {place}
      </Copy>
      <Copy kind="heading" style={styles.cardTitle}>
        {session.mode} · {durationLabel(session.durationMs)}
      </Copy>
      {!!themes && (
        <Copy kind="label" style={ui.secondary}>
          {themes}
        </Copy>
      )}
    </Pressable>
  );
}

export default function FieldLogScreen() {
  const { sessions, session: live } = useSession();
  const completed = sessions.filter((item) => item.endedAt !== null);

  return (
    <Screen>
      <Copy kind="title" accessibilityRole="header">
        Field Log
      </Copy>
      <Copy style={styles.supporting}>Things worth remembering.</Copy>

      {live?.active && (
        <Pressable
          onPress={() => router.push('/session')}
          accessibilityRole="button"
          accessibilityLabel={`Return to your ${live.mode} session`}
          style={({ pressed }) => [
            styles.resume,
            pressed && styles.cardPressed,
          ]}
        >
          <Copy kind="label" style={ui.secondary}>
            Session in progress
          </Copy>
          <Copy>{live.mode} · tap to return</Copy>
        </Pressable>
      )}

      {completed.length === 0 ? (
        <View style={styles.empty}>
          <Copy style={ui.secondary}>
            Nothing here yet. What you notice on a walk will collect here.
          </Copy>
        </View>
      ) : (
        <View style={styles.list}>
          {completed.map((item) => (
            <SessionCard key={item.id} session={item} />
          ))}
        </View>
      )}

      <View style={styles.footer}>
        <Button
          label="Home"
          accessibilityLabel="Back to home"
          onPress={() => router.replace('/')}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  supporting: { color: colors.yale, marginTop: spacing.sm },
  list: { marginTop: spacing.xxl, gap: spacing.xl },
  card: {
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.powder,
  },
  cardPressed: { opacity: 0.6 },
  cardTitle: { color: colors.ink },
  resume: {
    marginTop: spacing.xl,
    gap: spacing.xs,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.lg,
    borderWidth: 1,
    borderColor: colors.powder,
    borderRadius: 4,
  },
  empty: { marginTop: spacing.xxl, paddingVertical: spacing.xl },
  footer: { marginTop: spacing.xxxl },
});
