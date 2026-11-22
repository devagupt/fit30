import { Pause, Play } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { drawMovement, movementGuides } from './movementGuides';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

function subscribeToMotion(onChange: () => void) {
  const query = window.matchMedia(reducedMotionQuery);
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function MovementGuide({ exerciseId }: { exerciseId: string }) {
  const guide = movementGuides[exerciseId];
  const canvas = useRef<HTMLCanvasElement>(null);
  const phase = useRef(0);
  const [playing, setPlaying] = useState(false);
  const [alternatePose, setAlternatePose] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotion,
    () => window.matchMedia(reducedMotionQuery).matches,
    () => true,
  );
  const playingMotion = playing && !reducedMotion;

  useEffect(() => {
    const surface = canvas.current;
    if (!surface || !guide) return;
    if (!playingMotion) {
      drawMovement(surface, guide, reducedMotion || guide.static ? (alternatePose ? 0.5 : 0) : phase.current);
      return;
    }
    const initialPhase = phase.current;
    let started: number | undefined;
    let frame: number;
    const animate = (time: number) => {
      started ??= time;
      phase.current = (initialPhase + (time - started) / 3200) % 1;
      drawMovement(surface, guide, phase.current);
      frame = window.requestAnimationFrame(animate);
    };
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [alternatePose, guide, playingMotion, reducedMotion]);

  if (!guide) return null;
  return (
    <section className="fit-movement-guide" aria-label="Offline movement guide">
      <h3>Movement guide</h3>
      <canvas ref={canvas} width={512} height={268} aria-hidden="true" />
      <p>{guide.description}</p>
      {guide.alternatePoseLabel || (!guide.static && reducedMotion) ? (
        <button type="button" className="button button-secondary" onClick={() => setAlternatePose((showing) => !showing)}>
          {alternatePose ? 'Show starting pose' : guide.alternatePoseLabel ?? 'Show next pose'}
        </button>
      ) : !guide.static && (
        <button type="button" className="button button-secondary" onClick={() => setPlaying((running) => !running)}>
          {playingMotion ? <Pause size={18} aria-hidden="true" /> : <Play size={18} aria-hidden="true" />}
          {playingMotion ? 'Pause guide' : 'Play guide'}
        </button>
      )}
    </section>
  );
}
