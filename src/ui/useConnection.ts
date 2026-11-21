import { useEffect, useState } from 'react';

export type OfflineStatus = 'ready' | 'preparing' | 'setup_failed' | 'unavailable';

interface InstallPrompt extends Event {
  prompt: () => Promise<unknown>;
}

export function useConnection() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const eligible = import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator;
  const [offlineStatus, setOfflineStatus] = useState<OfflineStatus>(eligible ? 'preparing' : 'unavailable');
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt | null>(null);
  const [appInstalled, setAppInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches);
  const [setupAttempt, setSetupAttempt] = useState(0);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!eligible) return;
    const workerApi = navigator.serviceWorker;
    let listening = true;
    let installing: ServiceWorker | null = null;

    const checkController = () => {
      if (workerApi.controller) setOfflineStatus('ready');
    };
    const setupFailed = () => {
      if (listening && !workerApi.controller) setOfflineStatus('setup_failed');
    };
    const checkInstall = () => {
      if (installing?.state === 'redundant') setupFailed();
    };

    workerApi.addEventListener('controllerchange', checkController);
    if (workerApi.controller) checkController();
    else setOfflineStatus(online ? 'preparing' : 'setup_failed');

    if (online) {
      void workerApi.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
        if (!listening) return;
        checkController();
        installing = registration.installing;
        installing?.addEventListener('statechange', checkInstall);
        checkInstall();
        if (!installing && !registration.waiting && !registration.active) setupFailed();
      }).catch(setupFailed);
    }

    return () => {
      listening = false;
      workerApi.removeEventListener('controllerchange', checkController);
      installing?.removeEventListener('statechange', checkInstall);
    };
  }, [eligible, online, setupAttempt]);

  useEffect(() => {
    if (!eligible) return;
    const offerInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    const recordInstall = () => {
      setAppInstalled(true);
      setInstallPrompt(null);
      void navigator.storage?.persist?.().catch(() => {});
    };
    window.addEventListener('beforeinstallprompt', offerInstall);
    window.addEventListener('appinstalled', recordInstall);
    return () => {
      window.removeEventListener('beforeinstallprompt', offerInstall);
      window.removeEventListener('appinstalled', recordInstall);
    };
  }, [eligible]);

  function install() {
    if (!installPrompt) return;
    setInstallPrompt(null);
    void installPrompt.prompt().catch(() => {});
  }

  return {
    online,
    offlineStatus,
    appInstalled,
    install: installPrompt && !appInstalled && offlineStatus === 'ready' ? install : undefined,
    retryOffline: online && offlineStatus === 'setup_failed' ? () => setSetupAttempt((value) => value + 1) : undefined,
  };
}
