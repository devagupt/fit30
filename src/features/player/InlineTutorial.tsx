import { CirclePlay, RotateCw } from 'lucide-react';
import { useEffect, useState } from 'react';

interface InlineTutorialProps {
  url: string;
  name: string;
  onOpenVideo?: () => void;
}

type Playback = 'idle' | 'loading' | 'loaded' | 'unavailable';

export function InlineTutorial({ url, name, onOpenVideo }: InlineTutorialProps) {
  const [playback, setPlayback] = useState<Playback>('idle');

  useEffect(() => {
    if (playback !== 'loading') return;
    const timeout = window.setTimeout(() => setPlayback('unavailable'), 10_000);
    return () => window.clearTimeout(timeout);
  }, [playback]);

  function play() {
    setPlayback('loading');
    onOpenVideo?.();
  }

  return (
    <div className="fit-player-video__stage">
      {playback === 'idle' ? (
        <button type="button" className="button fit-player-video__play" onClick={play}>
          <CirclePlay size={32} aria-hidden="true" /> Play video
        </button>
      ) : playback === 'unavailable' ? (
        <div className="fit-player-video__message">
          <p role="status">The video couldn’t load here. Try again or use the form cues below.</p>
          <button type="button" className="button button-secondary" onClick={play}>
            <RotateCw size={17} aria-hidden="true" /> Retry video
          </button>
        </div>
      ) : (
        <>
          <iframe
            title={`${name} video tutorial`}
            src={url}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => setPlayback('loaded')}
            onError={() => setPlayback('unavailable')}
          />
          {playback === 'loading' && <p className="fit-player-video__loading" role="status">Loading video…</p>}
        </>
      )}
    </div>
  );
}
