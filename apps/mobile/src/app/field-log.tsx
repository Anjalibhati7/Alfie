import { useState } from 'react';
import { useStatusAnnouncement } from '../accessibility/useStatusAnnouncement';
import { router } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy, Eyebrow, Rule, ui } from '../components/ui';
import { spacing } from '../design/tokens';
import { formatTime, useSession } from '../state/session';

export default function FieldLogScreen() {
  const { session, entries, edit, remove } = useSession();
  const [editing, setEditing] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  useStatusAnnouncement(message);
  return (
    <Screen>
      <Eyebrow>Alfie / Collected moments</Eyebrow>
      <Rule />
      {session && !session.active && (
        <View style={styles.summary}>
          <Eyebrow>Session complete</Eyebrow>
          <Copy kind="heading">A moment, well spent.</Copy>
          <Copy kind="label">
            {session.mode} · {formatTime(session.elapsed)} active time
          </Copy>
        </View>
      )}
      <Copy kind="title" accessibilityRole="header">
        Field Log
      </Copy>
      <Copy style={styles.lead}>Something worth keeping.</Copy>
      <Copy kind="label" style={ui.secondary}>
        Temporary preview · Notes stay in app memory only. Reloading or closing
        the app clears them. Nothing is sent to a server.
      </Copy>
      <Rule />
      {!!message && (
        <Copy accessibilityLiveRegion="polite" kind="label">
          {message}
        </Copy>
      )}
      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Eyebrow>No entries yet</Eyebrow>
          <Copy kind="heading">
            A detail. A question.{'\n'}An idea for later.
          </Copy>
          <Copy style={ui.secondary}>
            Save a thought during a session and it will find a place here.
          </Copy>
        </View>
      ) : (
        entries.map((entry, index) => (
          <View key={entry.id}>
            <Eyebrow>
              {String(entries.length - index).padStart(2, '0')} / {entry.mode}
            </Eyebrow>
            {editing === entry.id ? (
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
                    edit(entry.id, text);
                    setEditing(null);
                    setMessage('Changes saved in this preview.');
                  }}
                />
                <Button label="Cancel edit" onPress={() => setEditing(null)} />
              </View>
            ) : (
              <>
                <Copy style={styles.entry}>{entry.text}</Copy>
                <View style={ui.row}>
                  <Button
                    label={`Edit entry ${entries.length - index}`}
                    onPress={() => {
                      setEditing(entry.id);
                      setText(entry.text);
                      setDeleting(null);
                    }}
                  />
                  <Button
                    label={`Delete entry ${entries.length - index}`}
                    onPress={() => setDeleting(entry.id)}
                  />
                </View>
              </>
            )}
            {deleting === entry.id && (
              <View style={styles.editor}>
                <Copy kind="label">
                  Delete this thought from the temporary Field Log?
                </Copy>
                <Button
                  label="Confirm delete"
                  onPress={() => {
                    remove(entry.id);
                    setDeleting(null);
                    setMessage('Thought deleted.');
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
  entry: { marginVertical: spacing.lg },
  editor: { gap: spacing.lg, marginTop: spacing.lg },
});
