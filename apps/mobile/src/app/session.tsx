import { useState } from 'react';
import { useStatusAnnouncement } from '../accessibility/useStatusAnnouncement';
import { Redirect, router } from 'expo-router';
import { StyleSheet, TextInput, View } from 'react-native';
import { Screen } from '../components/Screen';
import { Button, Copy, Eyebrow, ui } from '../components/ui';
import { colors, spacing } from '../design/tokens';
import { formatTime, useSession, type LocationMode } from '../state/session';

export default function LiveSessionScreen() {
  const {
    session,
    voice,
    status,
    error,
    draft,
    setDraft,
    place,
    trail,
    locationMode,
    persistent,
    capturing,
    level,
    closeCode,
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

  /**
   * One explicit stage so the audio path is never ambiguous. These are read from
   * existing session state; nothing here produces them.
   */
  const stage: { label: string; detail: string } = session.paused
    ? { label: 'Paused', detail: 'Microphone off. Resume when you are ready.' }
    : status === 'error'
      ? { label: 'Stopped', detail: error ?? 'The voice session stopped.' }
      : status === 'connecting'
        ? { label: 'Connecting', detail: 'Opening a secure voice connection.' }
        : !capturing
          ? {
              label: 'Microphone waiting',
              detail:
                'Connected, but the microphone is not delivering audio yet.',
            }
          : voice === 'Thinking'
            ? { label: 'Thinking…', detail: 'Working out what to say.' }
            : voice === 'Speaking'
              ? {
                  label: 'Speaking',
                  detail: 'Alfie is speaking. Say anything to interrupt.',
                }
              : {
                  label: 'Listening',
                  detail:
                    level > 0.02
                      ? 'Hearing you.'
                      : 'Microphone live. Say something.',
                };

  const levelPercent = Math.round(level * 100);

  function finish() {
    // Capture the id before ending: the user should land on the memory of the
    // walk they just finished, not on a list.
    const finishedId = session?.id;
    end();
    router.replace(finishedId ? '/field-log/' + finishedId : '/field-log');
  }

  return (
    <Screen>
      <View style={styles.masthead}>
        <Eyebrow>{session.mode}</Eyebrow>
        <Copy
          kind="label"
          style={styles.timer}
          accessibilityLabel={`Session duration ${formatTime(session.elapsed)}`}
        >
          {formatTime(session.elapsed)}
        </Copy>
      </View>

      {error !== null && (
        <View style={styles.error} accessibilityLiveRegion="assertive">
          <Eyebrow>Connection</Eyebrow>
          <Copy kind="heading">{error}</Copy>
          {closeCode !== null && (
            <Copy kind="label" style={ui.secondary}>
              Voice service close code {closeCode}
              {closeCode === 3000
                ? ' · the API key was rejected as invalid or expired'
                : closeCode === 4429
                  ? ' · billing refused the session'
                  : closeCode === 1013
                    ? ' · concurrency limit reached'
                    : ''}
            </Copy>
          )}
          <Button label="Retry" primary onPress={retry} />
        </View>
      )}

      {/* The voice state is the whole screen. Nothing competes with it. */}
      <View style={styles.stage}>
        <Copy
          kind="title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`Voice state: ${stage.label}`}
        >
          {stage.label}
        </Copy>
        <Copy style={ui.secondary}>{stage.detail}</Copy>

        {voice === 'Speaking' && !session.paused && status === 'connected' && (
          <Button
            label="Interrupt"
            variant="quiet"
            onPress={interrupt}
            hint="Stops Alfie speaking so you can talk"
          />
        )}
      </View>

      {/* Subtle voice activity. The only on-screen proof the microphone works. */}
      <View style={styles.activity} accessibilityLiveRegion="polite">
        <View
          style={styles.meterTrack}
          accessibilityRole="progressbar"
          accessibilityLabel="Microphone input level"
          accessibilityValue={{ min: 0, max: 100, now: levelPercent }}
        >
          <View style={[styles.meterFill, { width: `${levelPercent}%` }]} />
        </View>
        <View style={styles.activityRow}>
          <Eyebrow>{capturing ? 'Mic on' : 'Mic off'}</Eyebrow>
          <Copy kind="label" style={styles.muted}>
            {capturing
              ? level > 0.02
                ? 'Hearing you'
                : 'Silent'
              : 'Not capturing'}
          </Copy>
        </View>
      </View>

      <View style={styles.area}>
        <Eyebrow>Current area</Eyebrow>
        <Copy kind="heading">
          {place ? place.label : 'Location not in use'}
        </Copy>
        <Copy kind="label" style={styles.muted}>
          {place
            ? `${place.simulated ? 'Simulated route' : 'Approximate position'} · ${
                trail.length
              } place${trail.length === 1 ? '' : 's'}`
            : 'Alfie works without location.'}
        </Copy>
        <View style={styles.sources}>
          {(['demo', 'real'] as LocationMode[]).map((mode) => (
            <Button
              key={mode}
              label={mode === 'demo' ? 'Demo route' : 'This device'}
              variant="quiet"
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

      <View style={styles.actions}>
        <Button
          label="Save a thought"
          variant="quiet"
          expanded={note}
          onPress={() => {
            setNote(!note);
            setSaved('');
          }}
        />
        {note && (
          <View style={ui.section}>
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
            <Copy kind="label" style={styles.muted}>
              {persistent
                ? 'Saved on this device only.'
                : 'Kept for this run only; this device cannot store it.'}
            </Copy>
            <Button
              label="Keep it"
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
              label="Cancel"
              variant="quiet"
              onPress={() => setNote(false)}
            />
          </View>
        )}
        {!!saved && (
          <Copy kind="label" accessibilityLiveRegion="polite">
            {saved}
          </Copy>
        )}

        <View style={styles.controls}>
          <Button
            label={session.paused ? 'Resume' : 'Pause'}
            variant="quiet"
            onPress={pause}
            hint={
              session.paused
                ? 'Reopens the microphone.'
                : 'Closes the microphone until you resume.'
            }
          />
          <Button label="End" primary onPress={() => setEnding(true)} />
        </View>
      </View>

      {ending && (
        <View style={styles.confirm}>
          <Eyebrow>Finish</Eyebrow>
          <Copy kind="heading">Finish for now?</Copy>
          <Copy kind="label" style={styles.muted}>
            {draft.trim()
              ? 'You have an unsaved thought. Keep it, or discard it.'
              : 'Ending stops the microphone and closes the voice connection.'}
          </Copy>
          {draft.trim() ? (
            <>
              <Button
                label="Keep thought and finish"
                primary
                onPress={() => {
                  save();
                  finish();
                }}
              />
              <Button
                label="Discard and finish"
                variant="quiet"
                onPress={() => {
                  setDraft('');
                  finish();
                }}
              />
            </>
          ) : (
            <Button label="Finish" primary onPress={finish} />
          )}
          <Button
            label="Keep going"
            variant="quiet"
            onPress={() => setEnding(false)}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  masthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  timer: { color: colors.ink },
  /** Asymmetrical: the state sits low and gets the most air. */
  stage: {
    paddingTop: spacing.xxxl,
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  activity: { gap: spacing.sm },
  meterTrack: {
    height: 2,
    backgroundColor: colors.powder,
    overflow: 'hidden',
  },
  meterFill: { height: 2, backgroundColor: colors.yale },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  area: {
    marginTop: spacing.xxxl,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.powder,
    paddingTop: spacing.xl,
  },
  sources: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actions: { marginTop: spacing.xxxl, gap: spacing.lg },
  controls: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  muted: { color: colors.yale },
  error: {
    marginTop: spacing.xl,
    gap: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: colors.ink,
    paddingLeft: spacing.lg,
  },
  confirm: {
    marginTop: spacing.xxxl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.powder,
    paddingTop: spacing.xl,
  },
});
