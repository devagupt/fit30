import { CirclePlay, RotateCw } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { loadYouTubePlayer } from './youtubePlayer';

interface InlineTutorialProps {
  url: string;
  name: string;
  onOpenVideo?: () => void;
}

type Playback = 'idle' | 'loading' | 'ready' | 'unavailable';

export function InlineTutorial({ url, name, onOpenVideo }: InlineTutorialProps) {
  const [playback, setPlayback] = useState<Playback>('idle');
  const [attempt, setAttempt] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const reportPlayback = useEffectEvent(() => onOpenVideo?.());

  useEffect(() => {
    const host = stage.current;
    if (attempt === 0 || !host) return;

    let closed = false;
    let reportedPlayback = false;
    let iframe: HTMLIFrameElement | undefined;
    let player: { destroy: () => void } | undefined;
    let timeout: number | undefined;

    const removePlayer = () => {
      player?.destroy();
      player = undefined;
      iframe?.remove();
    };
    const fail = () => {
      if (closed) return;
      closed = true;
      window.clearTimeout(timeout);
      removePlayer();
      setPlayback('unavailable');
    };
    const ready = () => {
      if (closed) return;
      window.clearTimeout(timeout);
      setPlayback('ready');
    };
    timeout = window.setTimeout(fail, 10_000);

    void loadYouTubePlayer().then((Player) => {
      if (closed) return;
      const embed = new URL(url);
      embed.searchParams.set('enablejsapi', '1');
      embed.searchParams.set('origin', window.location.origin);
      iframe = document.createElement('iframe');
      iframe.title = `${name} video tutorial`;
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.src = embed.href;
      host.append(iframe);

      player = new Player(iframe, {
        events: {
          onReady: ready,
          onAutoplayBlocked: ready,
          onError: fail,
          onStateChange: ({ data }) => {
            if (closed) return;
            if (data === 3) {
              window.clearTimeout(timeout);
              timeout = window.setTimeout(fail, 10_000);
              setPlayback('loading');
            } else if (data === 0 || data === 1 || data === 2 || data === 5) ready();
            if (data === 1 && !reportedPlayback) {
              reportedPlayback = true;
              reportPlayback();
            }
          },
        },
      });
    }).catch(fail);

    return () => {
      closed = true;
      window.clearTimeout(timeout);
      removePlayer();
    };
  }, [attempt, name, url]);

  function play() {
    setPlayback('loading');
    setAttempt((count) => count + 1);
  }

  if (playback === 'idle') return (
    <button type="button" className="button button-secondary" onClick={play}>
      <CirclePlay size={20} aria-hidden="true" /> Play video
    </button>
  );

  if (playback === 'unavailable') return (
    <div className="fit-player-video__message">
      <p role="status">The video couldn’t play here. The movement guide and form cues are available below.</p>
      <button type="button" className="button button-secondary" onClick={play}>
        <RotateCw size={17} aria-hidden="true" /> Retry video
      </button>
    </div>
  );

  return (
    <div className="fit-player-video__frame">
      <div className="fit-player-video__stage" ref={stage} />
      {playback === 'loading' && <p className="fit-player-video__loading" role="status">Loading video…</p>}
    </div>
  );
}
