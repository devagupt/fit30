import { CirclePlay, Info } from 'lucide-react';
import { categoryLabel, getExercise, tutorialEmbedUrl, tutorialWatchUrl } from '../../domain/program';
import { formatClock } from './formatClock';
import { InlineTutorial } from './InlineTutorial';
import { MovementGuide } from './MovementGuide';
import { PlayerDialog } from './PlayerDialog';
import './player.css';

interface TutorialDialogProps {
  exerciseId: string;
  online: boolean;
  onClose: () => void;
  onOpenVideo?: () => void;
  timerPaused?: boolean;
}

export function TutorialDialog({ exerciseId, online, onClose, onOpenVideo, timerPaused }: TutorialDialogProps) {
  const exercise = getExercise(exerciseId);
  const video = exercise.tutorial_video;
  const watchUrl = tutorialWatchUrl(exercise);
  const embedUrl = tutorialEmbedUrl(exercise);
  const start = video?.start_seconds ?? 0;
  const end = video?.end_seconds;
  const segment = end != null
    ? `Suggested segment ${formatClock(start)}–${formatClock(end)}`
    : start > 0 ? `Starts at ${formatClock(start)}` : null;
  const cues = [...new Set([exercise.instructions, ...exercise.quick_form_cues])]
    .filter((cue) => cue !== exercise.back_safety);

  return (
    <PlayerDialog title={exercise.name} eyebrow="Tutorial" onClose={onClose}>
      <p className="fit-player-dialog__meta">
        {categoryLabel(exercise.category)} · {exercise.equipment === 'none' ? 'No equipment' : exercise.equipment}
      </p>
      {timerPaused && <p className="fit-player-inline-note">Workout timer paused</p>}

      {watchUrl && online && (
        <div className="fit-player-video">
          {embedUrl && <InlineTutorial key={exerciseId} url={embedUrl} name={exercise.name} onOpenVideo={onOpenVideo} />}
          <div className="fit-player-video__info">
            <span className="fit-player-video__icon"><CirclePlay size={24} aria-hidden="true" /></span>
            <div>
              <h3>{video?.title ?? 'Exercise video'}</h3>
              {video?.creator && <p>{video.creator}</p>}
              {segment && <p>{segment}</p>}
            </div>
          </div>
          <a
            className="button button-quiet"
            href={watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={onOpenVideo}
          >
            Open video in YouTube
          </a>
        </div>
      )}
      {!online && <p className="fit-player-inline-note" role="status">You’re offline. The movement guide and written cues are available below.</p>}
      {online && !watchUrl && <p className="fit-player-inline-note">Video unavailable. Use the movement guide and written cues below.</p>}

      <MovementGuide key={exerciseId} exerciseId={exerciseId} />

      {video?.exercise_match_note && (
        <div className="fit-player-notice">
          <Info size={19} aria-hidden="true" />
          <div>
            <h3>Check your equipment</h3>
            <p>{video.exercise_match_note}</p>
            {(exerciseId === 'low_row_machine' || exerciseId === 'leg_press_machine') && (
              <p>If your machine looks different, ask gym staff about the setup or skip the movement.</p>
            )}
          </div>
        </div>
      )}

      <section className="fit-player-dialog__section">
        <h3>Form cues</h3>
        {cues.length > 1 ? (
          <ul>{cues.map((cue) => <li key={cue}>{cue}</li>)}</ul>
        ) : <p>{cues[0]}</p>}
      </section>
      <section className="fit-player-dialog__section">
        <h3>Lower-back cue</h3>
        <p>{exercise.back_safety}</p>
      </section>
      <p className="fit-player-dialog__meta">{exercise.instructional_disclaimer}</p>
    </PlayerDialog>
  );
}
