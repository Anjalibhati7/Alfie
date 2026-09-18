import { useState } from 'react';
import { useStatusAnnouncement } from '../accessibility/useStatusAnnouncement';
import { router } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy, Eyebrow, Rule, ui } from '../components/ui';
import { colors, spacing } from '../design/tokens';
import { formatTime, useSession } from '../state/session';
import type { JournalSession } from '../services/journal/storage';

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Unknown time';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FieldLogScreen() {
  const {
    session,
    sessions,
    persistent,
    editThought,
    removeThought,
    removeSession,
    announcement,
    setAnnouncement,
  } = useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmSession, setConfirmSession] = useState<string | null>(null);

  useStatusAnnouncement(announcement);

  const latest: JournalSession | undefined = sessions[0];
  const completed = latest && latest.endedAt !== null;
  const thoughts = sessions.flatMap((item) =>
    item.thoughts.map((thought) => ({ ...thought, mode: item.mode })),
  );

  return (
    <Screen>
      <Eyebrow>Alfie / Collected moments</Eyebrow>
      <Rule />

      {latest && completed && (
        <View style={styles.summary}>
          <Eyebrow>Session complete</Eyebrow>
          <Copy kind="heading">A moment, well spent.</Copy>
          <Copy kind="label">
            {latest.mode} · {formatTime(latest.durationMs)} active time
          </Copy>
          <Copy kind="label" style={ui.secondary}>
            {formatWhen(latest.endedAt ?? latest.startedAt)}
          </Copy>
        </View>
      )}

      {latest && !completed && (
        <View style={styles.summary}>
          <Eyebrow>Session in progress</Eyebrow>
          <Copy kind="label">
            {latest.mode} · started {formatWhen(latest.startedAt)}
          </Copy>
          <Copy kind="label" style={ui.secondary}>
            Finish the session to record its length, themes, and route.
          </Copy>
        </View>
      )}

      <Copy kind="title" accessibilityRole="header">
        Field Log
      </Copy>
      <Copy style={styles.lead}>Something worth keeping.</Copy>
      <Copy kind="label" style={ui.secondary}>
        {persistent
          ? 'Stored on this device only. Nothing here is uploaded, and no audio or transcript is kept.'
          : 'This device cannot store data, so entries last for this run only. Nothing is uploaded.'}
      </Copy>
      <Rule />

      {!!announcement && (
        <Copy accessibilityLiveRegion="polite" kind="label">
          {announcement}
        </Copy>
      )}

      {!latest ? (
        <View style={styles.empty}>
          <Eyebrow>No sessions yet</Eyebrow>
          <Copy kind="heading">
            A detail. A question.{'\n'}An idea for later.
          </Copy>
          <Copy style={ui.secondary}>
            Start a Discover or Reimagine session and it will be recorded here.
          </Copy>
        </View>
      ) : (
        <>
          <View style={styles.block}>
            <Eyebrow>Discussion themes</Eyebrow>
            {latest.themes.length === 0 ? (
              <Copy style={ui.secondary}>
                No themes were drawn from this session. Themes come from words
                you said aloud, so a quiet session has none.
              </Copy>
            ) : (
              latest.themes.map((theme) => (
                <View key={theme.label} style={styles.theme}>
                  <Copy kind="heading">{theme.label}</Copy>
                  <Copy kind="label" style={ui.secondary}>
                    “{theme.detail}”
                  </Copy>
                </View>
              ))
            )}
            <Copy kind="label" style={ui.secondary}>
              Themes are counted from your own words on the device. No
              transcript is stored.
            </Copy>
          </View>

          <View style={styles.block}>
            <Eyebrow>Route</Eyebrow>
            {latest.route.length === 0 ? (
              <Copy style={ui.secondary}>
                No location was recorded for this session.
              </Copy>
            ) : (
              <>
                <Copy kind="label" style={ui.secondary}>
                  {latest.route.length} place
                  {latest.route.length === 1 ? '' : 's'}
                  {latest.route.every((point) => point.simulated)
                    ? ' · simulated demo route'
                    : ' · approximate device location'}
                </Copy>
                <View style={styles.route}>
                  {latest.route.map((point, index) => (
                    <Copy key={`${point.id}-${index}`} kind="label">
                      {String(index + 1).padStart(2, '0')} · {point.label}
                    </Copy>
                  ))}
                </View>
              </>
            )}
          </View>
        </>
      )}

      <Rule />

      <View style={styles.block}>
        <Eyebrow>Saved thoughts</Eyebrow>
        {thoughts.length === 0 ? (
          <Copy style={ui.secondary}>
            Use “Save a thought or discovery” during a session and it will find
            a place here.
          </Copy>
        ) : (
          thoughts.map((thought, index) => (
            <View key={thought.id} style={styles.entry}>
              <Eyebrow>
                {String(thoughts.length - index).padStart(2, '0')} ·{' '}
                {thought.mode}
              </Eyebrow>
              {editing === thought.id ? (
                <View style={styles.editor}>
                  <TextInput
                    accessibilityLabel="Edit saved thought"
                    value={text}
                    onChangeText={setText}
                    multiline
                    maxLength={2000}
                    style={ui.input}
                  />
                  <Button
                    label="Save changes"
                    primary
                    disabled={!text.trim()}
                    onPress={() => {
                      editThought(thought.id, text);
                      setEditing(null);
                      setAnnouncement('Changes saved on this device.');
                    }}
                  />
                  <Button
                    label="Cancel edit"
                    onPress={() => setEditing(null)}
                  />
                </View>
              ) : (
                <>
                  <Copy style={styles.thoughtText}>{thought.text}</Copy>
                  <View style={ui.row}>
                    <Button
                      label={`Edit thought ${thoughts.length - index}`}
                      onPress={() => {
                        setEditing(thought.id);
                        setText(thought.text);
                        setDeleting(null);
                      }}
                    />
                    <Button
                      label={`Delete thought ${thoughts.length - index}`}
                      onPress={() => setDeleting(thought.id)}
                    />
                  </View>
                </>
              )}
              {deleting === thought.id && (
                <View style={styles.editor}>
                  <Copy kind="label">
                    Delete this thought from the Field Log? This cannot be
                    undone.
                  </Copy>
                  <Button
                    label="Confirm delete"
                    onPress={() => {
                      removeThought(thought.id);
                      setDeleting(null);
                      setAnnouncement('Thought deleted.');
                    }}
                  />
                  <Button
                    label="Keep thought"
                    onPress={() => setDeleting(null)}
                  />
                </View>
              )}
              <Rule />
            </View>
          ))
        )}
      </View>

      {latest && (
        <>
          <Rule />
          <View style={styles.block}>
            <Eyebrow>Device data</Eyebrow>
            <Copy kind="label" style={ui.secondary}>
              Deleting a session removes its themes and route from this device.
            </Copy>
            {confirmSession === latest.id ? (
              <>
                <Button
                  label="Confirm delete session"
                  onPress={() => {
                    removeSession(latest.id);
                    setConfirmSession(null);
                    setAnnouncement('Session deleted from this device.');
                  }}
                />
                <Button
                  label="Keep session"
                  onPress={() => setConfirmSession(null)}
                />
              </>
            ) : (
              <Button
                label="Delete this session"
                onPress={() => setConfirmSession(latest.id)}
              />
            )}
          </View>
        </>
      )}

      <Rule />
      <Button
        label={session?.active ? 'Return to session' : 'Back to home'}
        primary
        onPress={() => router.replace(session?.active ? '/session' : '/')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { gap: spacing.sm, marginBottom: spacing.xxxl },
  lead: { marginTop: spacing.sm, marginBottom: spacing.xl },
  empty: {
    paddingVertical: spacing.xl,
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  block: { gap: spacing.lg, marginBottom: spacing.xl },
  theme: {
    gap: spacing.xs,
    borderLeftWidth: 2,
    borderLeftColor: colors.powder,
    paddingLeft: spacing.lg,
  },
  route: {
    gap: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.yale,
    paddingLeft: spacing.lg,
  },
  entry: { gap: spacing.md },
  thoughtText: { marginVertical: spacing.md },
  editor: { gap: spacing.lg, marginTop: spacing.lg },
});
