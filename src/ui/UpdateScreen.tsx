import { useState } from 'react';

const home = import.meta.env.BASE_URL;
export const updateQuery = 'fit30-update';
export const updateUrl = `${home}index.html?${updateQuery}=1`;

function activateUpdate(worker: ServiceWorker) {
  return new Promise<void>((resolve, reject) => {
    const checkState = () => {
      if (worker.state === 'activated') finish();
      else if (worker.state === 'redundant') finish(new Error('The Fit30 update download was interrupted.'));
      else if (worker.state === 'installed') {
        try {
          worker.postMessage({ type: 'APPLY_FIT30_UPDATE' });
        } catch {
          finish(new Error('The Fit30 update could not be activated.'));
        }
      }
    };
    const finish = (error?: Error) => {
      window.clearTimeout(timeout);
      worker.removeEventListener('statechange', checkState);
      if (error) reject(error);
      else resolve();
    };
    const timeout = window.setTimeout(() => finish(new Error('The Fit30 update did not finish.')), 45_000);
    worker.addEventListener('statechange', checkState);
    checkState();
  });
}

async function downloadUpdate(registration: ServiceWorkerRegistration) {
  let preparing = registration.installing ?? registration.waiting;
  const trackInstall = () => { preparing = registration.installing ?? preparing; };
  registration.addEventListener('updatefound', trackInstall);
  try {
    await registration.update();
    const worker = registration.installing ?? registration.waiting ?? preparing ?? registration.active;
    if (!worker) throw new Error('The Fit30 update is unavailable.');
    await activateUpdate(worker);
  } finally {
    registration.removeEventListener('updatefound', trackInstall);
  }
}

export function UpdateScreen() {
  const [status, setStatus] = useState<'idle' | 'updating' | 'failed'>('idle');
  const available = import.meta.env.PROD && window.isSecureContext && 'serviceWorker' in navigator;
  const updating = status === 'updating';

  async function applyUpdate() {
    if (!available || updating) return;
    setStatus('updating');

    try {
      const registration = await navigator.serviceWorker.getRegistration(home)
        ?? await navigator.serviceWorker.register(`${home}sw.js`);
      await downloadUpdate(registration);
      window.location.replace(home);
    } catch {
      setStatus('failed');
    }
  }

  return (
    <main className="app-content app-update">
      <header className="page-heading">
        <h1>Update Fit30</h1>
        <p>Get the latest version for this device. Fit30 keeps your saved workouts and settings.</p>
      </header>
      <div className="panel app-update-actions">
        {available ? (
          <button className="button button-primary" type="button" disabled={updating} onClick={() => void applyUpdate()}>
            {status === 'failed' ? 'Try update again' : 'Apply update'}
          </button>
        ) : (
          <p>Open the trusted HTTPS preview to update Fit30 on this device.</p>
        )}
        {updating && <p role="status">Downloading and applying the update…</p>}
        {status === 'failed' && <p role="alert">The update couldn’t finish. Connect to the Mac’s Wi-Fi and try again.</p>}
        <a className="button button-quiet" href={home}>Back to Fit30</a>
      </div>
    </main>
  );
}
