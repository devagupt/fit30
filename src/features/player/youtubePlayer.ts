interface PlayerEvents {
  onReady: () => void;
  onStateChange: (event: { data: number }) => void;
  onError: (event: { data: number }) => void;
  onAutoplayBlocked: () => void;
}

type PlayerConstructor = new (iframe: HTMLIFrameElement, options: { events: PlayerEvents }) => { destroy: () => void };
type YouTubeWindow = Window & {
  YT?: { Player?: PlayerConstructor };
  onYouTubeIframeAPIReady?: () => void;
};

let loading: Promise<PlayerConstructor> | undefined;

export function loadYouTubePlayer(): Promise<PlayerConstructor> {
  const browser = window as YouTubeWindow;
  if (browser.YT?.Player) return Promise.resolve(browser.YT.Player);
  if (loading) return loading;

  loading = new Promise<PlayerConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    const previous = browser.onYouTubeIframeAPIReady;
    const finish = (Player?: PlayerConstructor) => {
      window.clearTimeout(timeout);
      browser.onYouTubeIframeAPIReady = previous;
      script.removeEventListener('error', failed);
      if (Player) resolve(Player);
      else {
        script.remove();
        reject(new Error('YouTube player unavailable'));
      }
    };
    const failed = () => finish();
    const timeout = window.setTimeout(failed, 10_000);

    browser.onYouTubeIframeAPIReady = () => {
      finish(browser.YT?.Player);
      previous?.();
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.addEventListener('error', failed, { once: true });
    document.head.append(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });

  return loading;
}
