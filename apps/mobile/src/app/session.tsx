import { useState } from 'react';
import { useStatusAnnouncement } from '../accessibility/useStatusAnnouncement';
import { Redirect, router } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy, Eyebrow, Rule, ui } from '../components/ui';
import { colors, spacing } from '../design/tokens';
import { formatTime, useSession, type LocationMode } from '../state/session';

/** Places shown live on the session screen; the Field Log keeps them all. */
const RECENT_PLACES = 12;

export default function LiveSessionScreen() {
  const {
    session,
    voice,
    status,
    error,
    turns,
    draft,
    setDraft,
    place,
    trail,
    locationLabel,
    locationMode,
    persistent,
    announcement,
    pause,
    end,
    retry,
    interrupt,
    save,
    setAnnouncement,
    changeLocationMode,
  } = useSession();
  const [note, setNote] = useState(false);
  const [ending, setEnding] = useState(false);
  const [saved, setSaved] = useState('');

  useStatusAnnouncement(announcement);
  useStatusAnnouncement(saved);

  if (!session) return <Redirect href="/" />;
  if (!session.active) return <Redirect href="/field-log" />;

  const stateWord = session.paused
    ? 'Paused'
    : status === 'connecting'
      ? 'Connecting'
      : voice === 'Thinking'
        ? 'Thinking…'
        : voice;
  const stateDetail = session.paused
    ? 'Microphone off. Resume when you are ready.'
    : status === 'connecting'
      ? 'Opening a secure voice connection.'
      : voice === 'Listening'
        ? 'Room for your thoughts. Nothing is required from you.'
        : voice === 'Thinking'
          ? 'Working out what to say.'
          : 'Alfie is speaking. Say anything to interrupt.';

  const recent = turns.slice(-4);
  // A long demo walk accumulates one place every few seconds; the session screen
  // shows the most recent ones and the Field Log keeps the full route.
  const shownTrail = trail.slice(-RECENT_PLACES);
  const trailOffset = trail.length - shownTrail.length;

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
        {status === 'connected'
          ? 'Live voice · Microphone on'
          : status === 'connecting'
            ? 'Live voice · Connecting'
            : 'Live voice · Not connected'}
        {locationLabel ? ` · ${locationLabel}` : ''}
      </Copy>

      {error !== null && (
        <View style={styles.error} accessibilityLiveRegion="assertive">
          <Copy kind="heading" accessibilityRole="header">
            Voice connection problem
          </Copy>
          <Copy kind="label">{error}</Copy>
          <Button label="Retry connection" primary onPress={retry} />
        </View>
      )}

      <View style={styles.space}>
        <Eyebrow>{session.paused ? 'Session paused' : 'Voice state'}</Eyebrow>
        <Copy
          kind="title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Voice state: ${stateWord}`}
        >
          {stateWord}
        </Copy>
        <Copy style={ui.secondary}>{stateDetail}</Copy>
        {voice === 'Speaking' && !session.paused && status === 'connected' && (
          <Button label="Interrupt and speak" onPress={interrupt} />
        )}
      </View>

      <Rule />

      <View style={ui.section}>
        <Eyebrow>Where you are</Eyebrow>
        <Copy kind="heading">
          {place ? place.label : 'Location not in use'}
        </Copy>
        <Copy kind="label" style={ui.secondary}>
          {place?.simulated
            ? 'Simulated demo route. You are indoors and walking a scripted path.'
            : place
              ? 'Approximate position from this device.'
              : 'Alfie works without location. Conversation still uses the microphone.'}
        </Copy>
        <Copy kind="label" style={ui.secondary}>
          {trail.length > 0
            ? `${trail.length} place${trail.length === 1 ? '' : 's'} visited this session`
            : 'No places recorded yet'}
        </Copy>
        {trail.length > 0 && (
          <View
            style={styles.trail}
            accessibilityRole="list"
            accessibilityLabel="Places visited this session"
          >
            {trail.length > RECENT_PLACES && (
              <Copy kind="label" style={ui.secondary}>
                Showing the last {RECENT_PLACES} of {trail.length}
              </Copy>
            )}
            {shownTrail.map((point, index) => (
              <Copy key={`${point.id}-${index}`} kind="label">
                {String(trailOffset + index + 1).padStart(2, '0')} ·{' '}
                {point.label}
              </Copy>
            ))}
          </View>
        )}
        <View style={ui.row}>
          {(['demo', 'real'] as LocationMode[]).map((mode) => (
            <Button
              key={mode}
              label={mode === 'demo' ? 'Demo route' : 'This device'}
              selected={locationMode === mode}
              onPress={() => changeLocationMode(mode)}
              hint={
                mode === 'demo'
                  ? 'Uses a simulated walk so location can be demonstrated indoors.'
                  : 'Uses this device’s approximate foreground location.'
              }
            />
          ))}
        </View>
      </View>

      <Rule />

      <View style={ui.section}>
        <Eyebrow>Conversation</Eyebrow>
        {recent.length === 0 ? (
          <Copy style={ui.secondary}>
            Nothing said yet. Start with anything you notice.
          </Copy>
        ) : (
          recent.map((turn) => (
            <View key={turn.id} style={styles.turn}>
              <Copy kind="label" style={ui.secondary}>
                {turn.role === 'user' ? 'You' : 'Alfie'}
                {turn.streaming ? ' · speaking' : ''}
              </Copy>
              <Copy>{turn.text}</Copy>
            </View>
          ))
        )}
        <Copy kind="label" style={ui.secondary}>
          The spoken transcript is shown only for this session and is not saved
          or uploaded.
        </Copy>
      </View>

      <Rule />

      <View style={ui.section}>
        <Button
          label="Save a thought or discovery"
          expanded={note}
          onPress={() => {
            setNote(!note);
            setSaved('');
          }}
        />
        {note && (
          <View style={ui.section}>
            <Copy kind="label">
              Your note ·{' '}
              {persistent
                ? 'Saved on this device only.'
                : 'Kept in memory for this run only; this device cannot store it.'}
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
              label="Save to Field Log"
              primary
              disabled={!draft.trim()}
              onPress={() => {
                if (save()) {
                  setSaved('Saved to your Field Log.');
                  setAnnouncement('');
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
        {!!saved && (
          <Copy kind="label" accessibilityLiveRegion="polite">
            {saved}
          </Copy>
        )}
      </View>

      <Rule />

      <View style={ui.row}>
        <Button
          label={session.paused ? 'Resume session' : 'Pause session'}
          primary
          onPress={pause}
          hint={
            session.paused
              ? 'Reopens the microphone.'
              : 'Closes the microphone and stops the voice until you resume.'
          }
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
              : 'Ending stops the microphone and closes the voice connection straight away.'}
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  space: { paddingVertical: spacing.xxl, gap: spacing.lg },
  error: {
    marginTop: spacing.xl,
    gap: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.terracotta,
    paddingLeft: spacing.lg,
  },
  trail: {
    gap: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.powder,
    paddingLeft: spacing.lg,
  },
  turn: { gap: spacing.xs, marginBottom: spacing.lg },
  confirm: {
    marginTop: spacing.xl,
    gap: spacing.lg,
    borderLeftWidth: 2,
    borderLeftColor: colors.terracotta,
    paddingLeft: spacing.lg,
  },
});
