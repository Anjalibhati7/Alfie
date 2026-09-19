import { Fragment, useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { Screen } from '../../components/Screen';
import { Button, Copy, Eyebrow, Rule, ui } from '../../components/ui';
import { colors, spacing } from '../../design/tokens';
import { useSession } from '../../state/session';
import {
  durationLabel,
  longDateLabel,
  offsetLabel,
} from '../../services/journal/storage';

/** A lightweight trail: dots for each place, joined by a thin line. */
function RouteTrail({ labels }: { labels: string[] }) {
  return (
    <View style={styles.route}>
      <View
        style={styles.routeRow}
        accessibilityRole="image"
        accessibilityLabel={`Route with ${labels.length} place${labels.length === 1 ? '' : 's'}: from ${labels[0]} to ${labels[labels.length - 1]}`}
      >
        {labels.map((label, index) => (
          <Fragment key={`${label}-${index}`}>
            {index > 0 && <View style={styles.routeConnector} />}
            <View
              style={[
                styles.routeDot,
                (index === 0 || index === labels.length - 1) &&
                  styles.routeDotEnd,
              ]}
            />
          </Fragment>
        ))}
      </View>
      <View style={styles.routeLabels}>
        <Copy kind="label" style={ui.secondary}>
          {labels[0]}
        </Copy>
        {labels.length > 1 && (
          <Copy kind="label" style={ui.secondary}>
            {labels[labels.length - 1]}
          </Copy>
        )}
      </View>
    </View>
  );
}

export default function SessionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { sessions, removeSession, removeThought, setAnnouncement } =
    useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const session = sessions.find((item) => item.id === id);

  if (!session) {
    return (
      <Screen>
        <Copy kind="heading" accessibilityRole="header">
          This session is no longer in your Field Log.
        </Copy>
        <View style={styles.footer}>
          <Button
            label="Field Log"
            onPress={() => router.replace('/field-log')}
          />
        </View>
      </Screen>
    );
  }

  const metadata = `${longDateLabel(session.startedAt)} · ${session.mode} · ${durationLabel(session.durationMs)}`;
  const routeLabels = session.route.map((point) => point.label);

  return (
    <Screen>
      <Pressable
        onPress={() => router.replace('/field-log')}
        accessibilityRole="button"
        accessibilityLabel="Back to Field Log"
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Copy kind="label" style={ui.secondary}>
          ← Field Log
        </Copy>
      </Pressable>

      <Copy kind="title" accessibilityRole="header" style={styles.place}>
        {session.placeLabel ?? 'A walk'}
      </Copy>
      <Copy kind="label" style={ui.secondary}>
        {metadata}
      </Copy>

      {routeLabels.length > 0 && <RouteTrail labels={routeLabels} />}

      {session.observations.length > 0 && (
        <>
          <Rule />
          <View style={styles.section}>
            <Eyebrow>You noticed</Eyebrow>
            {session.observations.map((observation) => (
              <Copy key={observation} style={styles.entry}>
                {observation}
              </Copy>
            ))}
          </View>
        </>
      )}

      <Rule />
      <View style={styles.section}>
        <Eyebrow>Saved thoughts</Eyebrow>
        {session.thoughts.length === 0 ? (
          <Copy style={ui.secondary}>Nothing saved this time.</Copy>
        ) : (
          session.thoughts.map((thought) =>
            editing === thought.id ? (
              <View key={thought.id} style={styles.editor}>
                <Copy style={styles.entry}>“{thought.text}”</Copy>
                <View style={ui.row}>
                  <Button
                    label="Remove"
                    onPress={() => {
                      removeThought(thought.id);
                      setEditing(null);
                      setAnnouncement('Thought removed.');
                    }}
                  />
                  <Button label="Keep" onPress={() => setEditing(null)} />
                </View>
              </View>
            ) : (
              <Pressable
                key={thought.id}
                onPress={() => setEditing(thought.id)}
                accessibilityRole="button"
                accessibilityLabel={`Saved thought: ${thought.text}`}
                accessibilityHint="Opens options for this thought"
                style={({ pressed }) => [
                  styles.thought,
                  pressed && styles.pressed,
                ]}
              >
                <Copy style={styles.entry}>“{thought.text}”</Copy>
              </Pressable>
            ),
          )
        )}
      </View>

      {session.themes.length > 0 && (
        <>
          <Rule />
          <View style={styles.section}>
            <Eyebrow>Conversation themes</Eyebrow>
            <View style={styles.chips}>
              {session.themes.map((theme) => (
                <View key={theme} style={styles.chip}>
                  <Copy kind="label">{theme}</Copy>
                </View>
              ))}
            </View>
          </View>
        </>
      )}

      {session.moments.length > 0 && (
        <>
          <Rule />
          <View style={styles.section}>
            <Eyebrow>Moments</Eyebrow>
            {session.moments.map((moment, index) => (
              <View
                key={`${moment.atMs}-${moment.label}`}
                style={styles.moment}
              >
                <Copy kind="label" style={styles.momentIndex}>
                  {String(index + 1).padStart(2, '0')}
                </Copy>
                <View style={styles.momentBody}>
                  <Copy kind="label" style={styles.momentTime}>
                    {offsetLabel(moment.atMs)}
                  </Copy>
                  <Copy style={styles.momentLabel}>{moment.label}</Copy>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      <Rule />
      <View style={styles.section}>
        <Pressable
          onPress={() => setMore(!more)}
          accessibilityRole="button"
          accessibilityLabel="More options"
          accessibilityState={{ expanded: more }}
          style={({ pressed }) => [styles.more, pressed && styles.pressed]}
        >
          <Copy kind="label" style={ui.secondary}>
            {more ? 'Hide options' : 'More options'}
          </Copy>
        </Pressable>
        {more &&
          (confirmDelete ? (
            <View style={styles.section}>
              <Copy kind="label">
                Delete this session from this device? This cannot be undone.
              </Copy>
              <View style={ui.row}>
                <Button
                  label="Delete session"
                  onPress={() => {
                    removeSession(session.id);
                    setAnnouncement('Session deleted.');
                    router.replace('/field-log');
                  }}
                />
                <Button label="Keep" onPress={() => setConfirmDelete(false)} />
              </View>
            </View>
          ) : (
            <Button
              label="Delete this session"
              onPress={() => setConfirmDelete(true)}
            />
          ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  pressed: { opacity: 0.6 },
  place: { marginTop: spacing.xl },
  route: { marginTop: spacing.xxl, gap: spacing.md },
  routeRow: { flexDirection: 'row', alignItems: 'center' },
  routeConnector: { flex: 1, height: 1, backgroundColor: colors.powder },
  routeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.yale,
  },
  routeDotEnd: { width: 10, height: 10, borderRadius: 5 },
  routeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  section: { gap: spacing.md },
  entry: { marginTop: spacing.xs },
  thought: { paddingVertical: spacing.xs },
  editor: { gap: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.powder,
    borderRadius: 4,
  },
  moment: { flexDirection: 'row', gap: spacing.md, alignItems: 'baseline' },
  momentIndex: { color: colors.yale },
  momentBody: { flexShrink: 1, gap: 2 },
  momentTime: { color: colors.yale },
  momentLabel: { flexShrink: 1 },
  more: { paddingVertical: spacing.sm, alignSelf: 'flex-start' },
  footer: { marginTop: spacing.xxl },
});
