import { useState } from 'react';
import { useStatusAnnouncement } from '../accessibility/useStatusAnnouncement';
import { Redirect, router } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy, Eyebrow, Rule, ui } from '../components/ui';
import { colors, spacing } from '../design/tokens';
import { formatTime, useSession, type VoiceState } from '../state/session';

export default function LiveSessionScreen() {
  const { session, voice, setVoice, pause, end, draft, setDraft, save } =
    useSession();
  const [map, setMap] = useState(false);
  const [note, setNote] = useState(false);
  const [controls, setControls] = useState(false);
  const [ending, setEnding] = useState(false);
  const [message, setMessage] = useState('');
  useStatusAnnouncement(
    session?.paused ? 'Session paused' : `Preview ${voice}. Microphone off.`,
  );
  useStatusAnnouncement(message);
  if (!session) return <Redirect href="/" />;
  if (!session.active) return <Redirect href="/field-log" />;
  const prompt =
    session.mode === 'Discover'
      ? 'What’s a small detail you might usually pass by?'
      : 'Find an everyday object. What else could it become?';
  const detail = session.paused
    ? 'Take your time. Resume when you’re ready.'
    : voice === 'Listening'
      ? 'Room for your thoughts. No need to rush.'
      : voice === 'Thinking'
        ? 'Making room for a different perspective.'
        : prompt;
  function finish() {
    end();
    router.replace('/field-log');
  }
  return (
    <Screen>
      <View style={ui.row}>
        <Eyebrow>{session.mode}</Eyebrow>
        <Copy
          kind="label"
          accessibilityLabel={`Session duration ${formatTime(session.elapsed)}`}
        >
          {formatTime(session.elapsed)}
        </Copy>
      </View>
      <Rule />
      <Copy kind="label" style={ui.secondary}>
        Voice preview · Microphone off · No AI connected
      </Copy>
      <View style={styles.space}>
        <Eyebrow>
          {session.paused ? 'Session paused' : 'Simulated voice state'}
        </Eyebrow>
        <Copy
          kind="title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {session.paused
            ? 'Paused'
            : voice === 'Thinking'
              ? 'Thinking…'
              : voice === 'Speaking'
                ? 'Speaking'
                : 'Listening'}
        </Copy>
        <Copy style={ui.secondary}>{detail}</Copy>
        {voice === 'Speaking' && !session.paused && (
          <Button
            label="Interrupt preview"
            onPress={() => setVoice('Listening')}
          />
        )}
      </View>
      <View style={ui.section}>
        <Button
          label="Save a thought or discovery"
          onPress={() => {
            setNote(!note);
            setMessage('');
          }}
          expanded={note}
        />
        {note && (
          <View style={ui.section}>
            <Copy kind="label">
              Your note · Kept only in this app’s memory until reload.
            </Copy>
            <TextInput
              accessibilityLabel="Thought or discovery"
              placeholder="What would you like to keep?"
              placeholderTextColor={colors.yale}
              multiline
              maxLength={2000}
              style={ui.input}
              value={draft}
              onChangeText={setDraft}
            />
            <Button
              label="Save to temporary Field Log"
              primary
              disabled={!draft.trim()}
              onPress={() => {
                if (save()) {
                  setMessage('Saved to temporary Field Log.');
                  setNote(false);
                }
              }}
            />
            <Button
              label="Close editor, keep draft"
              onPress={() => setNote(false)}
            />
          </View>
        )}
        {!!message && (
          <Copy kind="label" accessibilityLiveRegion="polite">
            {message}
          </Copy>
        )}
        <Button
          label={map ? 'Collapse map area' : 'Expand map area'}
          expanded={map}
          onPress={() => setMap(!map)}
        />
        {map && (
          <View style={styles.map}>
            <Eyebrow>Map placeholder</Eyebrow>
            <Copy kind="heading">You don’t need a pin to begin.</Copy>
            <Copy kind="label">
              No map or location data is connected. Place context will be
              optional; this session works without it.
            </Copy>
          </View>
        )}
      </View>
      <Rule />
      <View style={ui.row}>
        <Button
          label={session.paused ? 'Resume session' : 'Pause session'}
          primary
          onPress={pause}
        />
        <Button label="End session" onPress={() => setEnding(true)} />
      </View>
      {ending && (
        <View style={styles.confirm}>
          <Copy accessibilityRole="header" kind="heading">
            Finish for now?
          </Copy>
          <Copy kind="label">
            {draft.trim()
              ? 'You have an unsaved thought. Save it before ending, or explicitly discard it.'
              : 'Your temporary notes will be available in the Field Log.'}
          </Copy>
          {draft.trim() ? (
            <>
              <Button
                label="Save thought and finish"
                primary
                onPress={() => {
                  save();
                  finish();
                }}
              />
              <Button
                label="Discard draft and finish"
                onPress={() => {
                  setDraft('');
                  finish();
                }}
              />
            </>
          ) : (
            <Button
              label="Finish and view Field Log"
              primary
              onPress={finish}
            />
          )}
          <Button label="Keep session open" onPress={() => setEnding(false)} />
        </View>
      )}
      <View style={styles.debug}>
        <Button
          label="Preview controls"
          expanded={controls}
          onPress={() => setControls(!controls)}
        />
        {controls && (
          <View style={ui.section}>
            <Copy kind="label">
              Manually preview a state. These controls do not start audio or AI.
            </Copy>
            <View style={ui.row}>
              {(['Listening', 'Thinking', 'Speaking'] as VoiceState[]).map(
                (state) => (
                  <Button
                    key={state}
                    label={state}
                    selected={voice === state}
                    disabled={session.paused}
                    onPress={() => setVoice(state)}
                  />
                ),
              )}
            </View>
          </View>
        )}
      </View>
    </Screen>
  );
}
const styles = StyleSheet.create({
  space: { paddingVertical: spacing.xxxl, gap: spacing.xl },
  map: { backgroundColor: colors.powder, padding: spacing.xl, gap: spacing.lg },
  confirm: {
    marginTop: spacing.xl,
    gap: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.terracotta,
    paddingLeft: spacing.lg,
  },
  debug: { marginTop: spacing.xxxl, gap: spacing.lg },
});
