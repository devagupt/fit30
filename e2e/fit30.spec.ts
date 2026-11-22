import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import { preview } from 'vite';

const testInstant = new Date('2026-11-20T09:30:00Z');
const videoOrigin = 'https://www.youtube-nocookie.com';

async function stubYouTubePlayer(page: Page, errors: number[] = []) {
  await page.route('https://www.youtube.com/iframe_api', (route) => route.fulfill({
    contentType: 'text/javascript',
    body: `
      const errors = ${JSON.stringify(errors)};
      window.YT = { Player: class {
        constructor(iframe, { events }) {
          this.iframe = iframe;
          const error = errors.shift();
          iframe.addEventListener('load', () => {
            if (error) events.onError({ data: error });
            else {
              events.onReady();
              events.onStateChange({ data: 1 });
            }
          });
        }
        destroy() { this.iframe.remove(); }
      } };
      window.onYouTubeIframeAPIReady?.();
    `,
  }));
}

async function onBoard(page: Page, startDate: string, reminderTime = '', url = '/', now = testInstant) {
  await page.clock.setFixedTime(now);
  await page.goto(url);
  await page.getByRole('button', { name: 'Get started' }).click();
  await page.getByLabel('Start date').fill(startDate);
  if (reminderTime) await page.getByLabel('Daily reminder time').fill(reminderTime);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Preview Day 1' }).click();
  const preview = page.getByRole('dialog', { name: 'Day 1 workout' });
  await expect(preview.getByText('2 × 20 sec hold · 5 min')).toBeVisible();
  await preview.getByRole('button', { name: 'Back to setup' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Begin program' }).click();
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
}

function button(page: Page, name: string) {
  return page.getByRole('button', { name, exact: true });
}

async function tab(page: Page, name: 'Today' | 'Calendar' | 'Progress' | 'Settings') {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name, exact: true }).click();
}

async function setLocalTime(page: Page, now: Date) {
  await page.clock.setFixedTime(now);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
}

async function completeAndAdvance(page: Page) {
  await button(page, 'Mark done & next').click();
  await button(page, 'Start next now').click();
}

async function finishScheduledWorkout(page: Page) {
  await button(page, 'Start workout').click();
  for (let exercise = 0; exercise < 4; exercise++) await completeAndAdvance(page);
  await button(page, 'Mark done & review').click();
  await button(page, 'Finish workout').click();
  await expect(button(page, 'View workout')).toBeVisible();
}

async function download(page: Page, name: string) {
  const [file] = await Promise.all([page.waitForEvent('download'), button(page, name).click()]);
  return readFile(await file.path());
}

test('carries over a missed Day 3, tracks its timer, and advances after it is logged', async ({ page }, info) => {
  await stubYouTubePlayer(page);
  await page.route(`${videoOrigin}/embed/**`, (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><title>Tutorial fixture</title><button>Pause clip</button>',
  }));
  await onBoard(page, '2026-11-18', '18:30', '/', new Date('2026-11-18T09:30:00Z'));
  await finishScheduledWorkout(page);
  await setLocalTime(page, new Date('2026-11-19T09:30:00Z'));
  await expect(page.getByText('Day 2 of 30')).toBeVisible();
  await finishScheduledWorkout(page);

  const makeUpInstant = new Date('2026-11-21T09:30:00Z');
  await setLocalTime(page, makeUpInstant);
  await expect(page.getByText('Day 3 of 30')).toBeVisible();
  await expect(button(page, 'Start today’s workout')).toBeVisible();
  await expect(button(page, 'Low row machine (lower row)')).toBeVisible();
  await page.screenshot({ path: info.outputPath('today-mobile.png'), scale: 'css' });
  await button(page, 'Continue plan').click();
  await expect(page.getByRole('timer')).toHaveText('10:00');
  await page.clock.setFixedTime(new Date(makeUpInstant.getTime() + 14_000));
  await button(page, 'Pause timer').click();
  await expect(button(page, 'Resume timer')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('09:46');
  await page.reload();
  await expect(button(page, 'Resume timer')).toBeVisible();
  await expect(page.getByRole('timer')).toHaveText('09:46');
  await button(page, 'Resume timer').click();
  await completeAndAdvance(page);
  await expect(page.getByRole('heading', { name: 'Stationary cycling' })).toBeVisible();
  await completeAndAdvance(page);
  await expect(page.getByRole('heading', { name: 'Low row machine (lower row)' })).toBeVisible();

  await button(page, 'Watch tutorial').click();
  const tutorial = page.getByRole('dialog', { name: 'Low row machine (lower row)' });
  await expect(tutorial.getByRole('link', { name: 'Open video in YouTube' }))
    .toHaveAttribute('href', 'https://www.youtube.com/watch?v=FU6YQawma2Q&t=13s');
  await expect(tutorial.getByText('Check your equipment')).toBeVisible();
  await expect(tutorial.getByText('Workout timer paused')).toBeVisible();
  const frame = tutorial.locator('iframe');
  await expect(frame).toHaveCount(0);
  await tutorial.getByRole('button', { name: 'Play video' }).click();
  await expect(frame).toHaveAttribute('src', /\/embed\/FU6YQawma2Q\?.*start=13&end=118&enablejsapi=1/);
  await expect(frame.contentFrame().getByRole('button', { name: 'Pause clip' })).toBeVisible();
  expect(page.context().pages()).toHaveLength(1);
  await page.clock.setFixedTime(new Date(makeUpInstant.getTime() + 134_000));
  await tutorial.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(frame).toHaveCount(0);
  await expect(page.getByRole('timer')).toHaveText('05:00');
  await expect(button(page, 'Resume timer')).toBeVisible();
  await button(page, 'Skip').click();
  await page.getByLabel('Skip reason (optional)').fill('Machine occupied');
  await button(page, 'Skip & next').click();
  await expect(page.getByRole('heading', { name: 'Glute bridge' })).toBeVisible();
  await page.getByText('Log sets', { exact: true }).click();
  await button(page, 'Mark set 1 done').click();
  await completeAndAdvance(page);
  await button(page, 'Mark done & review').click();
  await expect(page.getByRole('timer')).toHaveCount(0);
  await button(page, 'Finish workout').click();
  await expect(page.getByText('Completed with skips', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText('4 of 5 done')).toBeVisible();
  await expect(page.getByText('Skipped · Machine occupied', { exact: true })).toBeVisible();

  await button(page, 'View workout').click();
  await expect(page.getByRole('button', { name: /Day 3, Completed with skips/ })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Skipped · Machine occupied', { exact: true })).toBeVisible();
  await expect(page.getByText('Set 1 · 10 reps · Done', { exact: true })).toBeVisible();
  await tab(page, 'Progress');
  await expect(page.getByText('1 completed with skips')).toBeVisible();
  await expect(page.getByText('14 sec').first()).toBeVisible();

  await setLocalTime(page, new Date('2026-11-22T09:30:00Z'));
  await tab(page, 'Today');
  await expect(page.getByText('Day 4 of 30')).toBeVisible();
  await expect(button(page, 'Continue plan')).toBeVisible();
});

test('the tutorial fits narrow and landscape screens and recovers from a stall and a YouTube error', async ({ page }, info) => {
  await page.clock.install({ time: testInstant });
  await stubYouTubePlayer(page, [0, 101]);
  let unblock: () => void = () => {};
  const stalled = new Promise<void>((resolve) => { unblock = resolve; });
  let requests = 0;
  await page.route(`${videoOrigin}/embed/**`, async (route) => {
    if (++requests === 1) {
      await stalled;
      await route.abort().catch(() => {});
      return;
    }
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><button>Play clip</button>' });
  });

  try {
    await onBoard(page, '2026-11-20');
    await page.getByRole('button', { name: /Watch tutorial for Stationary cycling/ }).click();
    const tutorial = page.getByRole('dialog', { name: 'Stationary cycling' });
    await tutorial.getByRole('button', { name: 'Play video' }).click();
    await expect(tutorial.getByRole('status')).toHaveText('Loading video…');
    await expect.poll(() => requests).toBe(1);
    await page.clock.fastForward(10_100);
    await expect(tutorial.getByRole('status')).toHaveText(/video couldn’t play here/);
    await expect(tutorial.getByRole('heading', { name: 'Form cues' })).toBeVisible();
    await expect(tutorial.getByRole('region', { name: 'Offline movement guide' })).toBeVisible();
    await expect(tutorial.getByRole('link', { name: 'Open video in YouTube' })).toBeVisible();
    await tutorial.getByRole('button', { name: 'Retry video' }).click();
    await expect.poll(() => requests).toBe(2);
    await expect(tutorial.getByRole('button', { name: 'Retry video' })).toBeVisible();
    await expect(tutorial.locator('iframe')).toHaveCount(0);
    await tutorial.getByRole('button', { name: 'Retry video' }).click();
    const frame = tutorial.locator('iframe');
    await expect(frame).toHaveAttribute('src', /\/embed\/m1UF4RgGoY0\?.*&start=164&end=173&enablejsapi=1/);
    await expect(frame.contentFrame().getByRole('button', { name: 'Play clip' })).toBeVisible();
    for (const [width, height] of [[320, 580], [360, 640], [640, 360]]) {
      await page.setViewportSize({ width, height });
      const body = tutorial.locator('.fit-player-dialog__body');
      expect(await body.evaluate((element) => element.scrollWidth)).toBeLessThanOrEqual(await body.evaluate((element) => element.clientWidth));
      await body.evaluate((element) => element.scrollTo(0, element.scrollHeight));
      await expect(tutorial.getByRole('button', { name: 'Close', exact: true })).toBeInViewport();
      if (width === 360) {
        await body.evaluate((element) => element.scrollTo(0, 0));
        await page.screenshot({ path: info.outputPath('tutorial-mobile.png'), scale: 'css' });
      }
    }
  } finally {
    unblock();
  }
});

test('an optional walk stays a rest day and a make-up partial attempt is resumable', async ({ page }) => {
  await onBoard(page, '2026-11-14');
  await expect(page.getByRole('heading', { name: 'Rest day' })).toBeVisible();
  await expect(button(page, 'Start workout')).toHaveCount(0);
  await button(page, 'Start optional walk').click();
  await expect(page.getByRole('timer')).toHaveText('20:00');
  await page.clock.setFixedTime(new Date(testInstant.getTime() + 5_000));
  await button(page, 'Mark done & review').click();
  await button(page, 'Save walk').click();
  await expect(page.getByText('Walk logged')).toBeVisible();
  await tab(page, 'Calendar');
  await expect(page.getByRole('button', { name: /Day 7, Rest/ })).toBeVisible();
  await page.getByRole('button', { name: /Day 3, Not logged/ }).click();
  await button(page, 'Do missed workout now').click();
  await expect(page.getByText('Make-up workout · Day 3')).toBeVisible();
  await button(page, 'Mark done & next').click();
  await button(page, 'Exit workout').click();
  await button(page, 'Save partial').click();
  await expect(page.getByRole('heading', { name: 'Calendar' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Rest day' })).toBeVisible();
  await tab(page, 'Calendar');
  await page.getByRole('button', { name: /Day 3, Partial/ }).click();
  await expect(page.getByText(/Logged.*Make-up/i)).toBeVisible();
  await button(page, 'Resume workout').click();
  await expect(page.getByRole('heading', { name: 'Rest', exact: true })).toBeVisible();
  await button(page, 'Start next now').click();
  await expect(page.getByRole('heading', { name: 'Stationary cycling' })).toBeVisible();
});

test('restarting archives the previous run and keeps its saved workout history', async ({ page }) => {
  await onBoard(page, '2026-11-20');
  await button(page, 'Start workout').click();
  await button(page, 'Mark done & next').click();
  await button(page, 'Exit workout').click();
  await button(page, 'Save partial').click();
  await expect(page.getByText('1 of 5 done')).toBeVisible();
  await tab(page, 'Settings');
  await expect(page.getByLabel('Start date', { exact: true })).toBeDisabled();
  await button(page, 'Restart program').click();
  await page.getByLabel('New program start date').fill('2026-11-21');
  await button(page, 'Start new program').click();
  await expect(page.getByLabel('Start date', { exact: true })).toHaveValue('2026-11-21');
  await tab(page, 'Calendar');
  await page.getByLabel('Program run').selectOption({ label: 'Archived · 20 Nov 2026' });
  await expect(page.getByRole('button', { name: /Day 1, Partial/ })).toBeVisible();
  await expect(page.getByText(/Done · .* logged/).first()).toBeVisible();
  await expect(button(page, 'Resume workout')).toHaveCount(0);
});

test('resumes an interrupted offline download and saves progress without the Mac preview', async ({ page, context }) => {
  const origins = new Set<string>();
  context.on('request', (request) => origins.add(new URL(request.url()).origin));
  let downloadInterrupted = true;
  let indexDownloads = 0;
  const server = await preview({
    configFile: false,
    preview: { host: '127.0.0.1', port: 0, strictPort: true },
    plugins: [{
      name: 'interrupt-offline-download',
      configurePreviewServer({ middlewares }) {
        middlewares.use((request, response, next) => {
          if (request.url === '/index.html') indexDownloads += 1;
          if (downloadInterrupted && request.url === '/studio-welcome-duo.jpg') {
            response.writeHead(503).end();
            return;
          }
          next();
        });
      },
    }],
  });
  let url: string;
  try {
    const address = server.httpServer.address();
    if (!address || typeof address === 'string') throw new Error('Test preview did not open a local port');
    url = `http://127.0.0.1:${address.port}/`;
    await onBoard(page, '2026-11-20', '', url);
    await tab(page, 'Settings');
    await expect(button(page, 'Retry offline setup')).toBeVisible();
    expect(indexDownloads).toBe(1);
    downloadInterrupted = false;
    await button(page, 'Retry offline setup').click();
    await expect(page.getByText('Ready for offline workouts')).toBeVisible();
    expect(indexDownloads).toBe(1);
    const manifest = await page.request.get(`${url}manifest.webmanifest`);
    expect(await manifest.json()).toMatchObject({ name: 'Fit30', display: 'standalone', scope: './' });
    await page.close();
  } finally {
    await server.close();
  }

  const offlinePage = await context.newPage();
  await offlinePage.clock.setFixedTime(testInstant);
  await offlinePage.goto(url);
  await expect(offlinePage.getByRole('heading', { name: 'Today', exact: true })).toBeVisible();
  await context.setOffline(true);
  await expect(offlinePage.getByRole('status').filter({ hasText: 'Offline' })).toBeVisible();
  await tab(offlinePage, 'Settings');
  await expect(offlinePage.getByText('Ready for offline workouts')).toBeVisible();
  await tab(offlinePage, 'Today');
  await button(offlinePage, 'Start workout').click();
  await button(offlinePage, 'Watch tutorial').click();
  const tutorial = offlinePage.getByRole('dialog');
  await expect(tutorial.getByText('You’re offline. The movement guide and written cues are available below.')).toBeVisible();
  await expect(tutorial.getByRole('region', { name: 'Offline movement guide' })).toBeVisible();
  await tutorial.getByRole('button', { name: 'Play guide', exact: true }).click();
  await expect(tutorial.getByRole('button', { name: 'Pause guide', exact: true })).toBeVisible();
  await expect(tutorial.getByRole('heading', { name: 'Lower-back cue' })).toBeVisible();
  await expect(tutorial.locator('iframe')).toHaveCount(0);
  await tutorial.getByRole('button', { name: 'Close', exact: true }).click();
  await completeAndAdvance(offlinePage);
  await expect(offlinePage.getByRole('heading', { name: 'Stationary cycling' })).toBeVisible();
  await offlinePage.close();
  const reopened = await context.newPage();
  await reopened.clock.setFixedTime(testInstant);
  await reopened.goto(url);
  await expect(reopened.getByRole('heading', { name: 'Stationary cycling' })).toBeVisible();
  await expect(button(reopened, 'Resume timer')).toBeVisible();
  await button(reopened, 'Exit workout').click();
  await button(reopened, 'Save partial').click();
  await expect(reopened.getByText('1 of 5 done')).toBeVisible();
  expect([...origins]).toEqual([new URL(url).origin]);
});

test('backup restore and measurement exports preserve data and reminder time', async ({ page, browser }) => {
  await onBoard(page, '2026-11-20', '18:30');
  await button(page, 'Log measurement').click();
  await page.getByLabel('Waist (cm)', { exact: true }).fill('83.5');
  await button(page, 'Save measurement').click();
  await expect(page.getByText('83.5 cm').first()).toBeVisible();
  await tab(page, 'Settings');
  const firstCalendar = (await download(page, 'Export calendar reminders')).toString('utf8');
  expect(firstCalendar).toContain('DTSTART:20261120T130000Z');
  expect(firstCalendar).not.toContain('20261126T130000Z');
  await page.getByLabel('Daily reminder time').fill('19:15');
  await button(page, 'Save settings').click();
  const secondCalendar = (await download(page, 'Export calendar reminders')).toString('utf8');
  expect(secondCalendar).toContain('DTSTART:20261120T134500Z');
  expect((await download(page, 'Download measurement CSV')).toString('utf8')).toContain('83.5');
  const backup = await download(page, 'Download JSON backup');

  const transferContext = await browser.newContext();
  try {
    const transfer = await transferContext.newPage();
    await transfer.clock.setFixedTime(testInstant);
    await transfer.goto(page.url());
    await transfer.getByLabel('Fit30 backup file').setInputFiles({ name: 'fit30.json', mimeType: 'application/json', buffer: backup });
    const dialog = transfer.getByRole('dialog', { name: 'Restore Fit30 backup?' });
    await dialog.getByRole('button', { name: 'Restore backup', exact: true }).click();
    await expect(transfer.getByText('Day 1 of 30')).toBeVisible();
    await tab(transfer, 'Settings');
    await expect(transfer.getByLabel('Daily reminder time')).toHaveValue('19:15');
    await transfer.getByLabel('Fit30 backup file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{') });
    await expect(transfer.getByRole('alert')).toHaveText(/unreadable.*Fit30 JSON backup/);
    await transfer.reload();
    await tab(transfer, 'Progress');
    await expect(transfer.getByText('83.5 cm').first()).toBeVisible();
  } finally {
    await transferContext.close();
  }
});

test('a finished timer stays on the exercise and discarding takes confirmation', async ({ page }) => {
  await onBoard(page, '2026-11-20');
  await button(page, 'Start workout').click();
  await expect(page.getByRole('timer')).toHaveText('10:00');
  await page.clock.setFixedTime(new Date(testInstant.getTime() + 605_000));
  await expect(page.getByRole('timer', { name: 'Overtime' })).toHaveText('+00:05');
  await expect(page.getByRole('heading', { name: 'Treadmill - brisk walk / light jog' })).toBeVisible();
  await button(page, 'Exit workout').click();
  await button(page, 'Discard attempt').click();
  const confirm = page.getByRole('dialog', { name: 'Discard this attempt?' });
  await expect(confirm).toBeVisible();
  await confirm.getByRole('button', { name: 'Discard attempt' }).click();
  await expect(button(page, 'Start workout')).toBeVisible();
  await expect(page.getByText('0 of 5 done')).toBeVisible();
});

test('pause and done are saved while a background timer checkpoint is finishing', async ({ page }) => {
  await page.clock.install({ time: testInstant });
  await page.addInitScript(() => {
    const descriptor = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete');
    if (!descriptor?.set) return;
    const setOnComplete = descriptor.set;
    Object.defineProperty(IDBTransaction.prototype, 'oncomplete', {
      ...descriptor,
      set(this: IDBTransaction, callback: (event: Event) => void) {
        setOnComplete.call(this, (event: Event) => {
          const flags = document.documentElement.dataset;
          if (this.mode === 'readwrite' && flags.checkpoint === 'hold') {
            flags.checkpoint = 'held';
            document.addEventListener('release-checkpoint', () => callback.call(this, event), { once: true });
          } else callback.call(this, event);
        });
      },
    });
  });
  const flags = page.locator('html');
  const holdCheckpoint = async (time: number) => {
    await page.evaluate(() => { document.documentElement.dataset.checkpoint = 'hold'; });
    await page.clock.setFixedTime(new Date(testInstant.getTime() + time));
    await page.clock.fastForward(15_100);
    await expect(flags).toHaveAttribute('data-checkpoint', 'held');
    await expect(button(page, 'Pause timer')).toBeEnabled();
    await expect(button(page, 'Mark done & next')).toBeEnabled();
  };
  const releaseCheckpoint = () => page.evaluate(() => document.dispatchEvent(new Event('release-checkpoint')));

  await onBoard(page, '2026-11-20');
  await button(page, 'Start workout').click();
  await expect(button(page, 'Pause timer')).toBeVisible();
  await holdCheckpoint(15_000);
  await button(page, 'Pause timer').click();
  await expect(button(page, 'Resume timer')).toBeVisible();
  await releaseCheckpoint();

  await button(page, 'Resume timer').click();
  await expect(button(page, 'Pause timer')).toBeVisible();
  await holdCheckpoint(30_000);
  await button(page, 'Mark done & next').click();
  await expect(page.getByRole('heading', { name: 'Rest', exact: true })).toBeVisible();
  await releaseCheckpoint();
  await button(page, 'Start next now').click();
  await expect(page.getByRole('heading', { name: 'Stationary cycling', exact: true })).toBeVisible();
});

test('foreground timers keep the screen awake and signal exercise and rest ends once', async ({ page }, info) => {
  await page.addInitScript(() => {
    const increment = (key: string) => {
      const data = document.documentElement.dataset;
      data[key] = String(Number(data[key] ?? 0) + 1);
    };
    Object.defineProperty(navigator, 'wakeLock', { value: {
      async request() {
        increment('wakeLocks');
        return {
          released: false,
          async release() {
            this.released = true;
            increment('wakeReleases');
          },
        };
      },
    } });
    Object.defineProperty(navigator, 'vibrate', { value: () => {
      increment('vibrations');
      return true;
    } });
    Object.defineProperty(window, 'AudioContext', { value: class {
      state = 'running';
      currentTime = 0;
      destination = {};
      createOscillator() {
        return {
          frequency: {},
          connect: (next: unknown) => next,
          disconnect() {},
          start() { increment('tones'); },
          stop() {},
        };
      }
      createGain() {
        return {
          gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
          connect() {},
          disconnect() {},
        };
      }
    } });
  });
  const html = page.locator('html');
  await onBoard(page, '2026-11-20');
  await tab(page, 'Settings');
  await page.getByLabel('Play a sound').check();
  await page.getByLabel('Vibrate when supported').check();
  await button(page, 'Test alert').click();
  await expect(page.getByText('Chime played. Vibration requested.')).toBeVisible();
  await expect(html).toHaveAttribute('data-tones', '2');
  await expect(html).toHaveAttribute('data-vibrations', '1');
  await button(page, 'Save settings').click();
  await expect(page.getByText('Settings saved.')).toBeVisible();

  await tab(page, 'Today');
  await button(page, 'Start workout').click();
  await expect(html).toHaveAttribute('data-wake-locks', '1');
  await button(page, 'Pause timer').click();
  await expect(html).toHaveAttribute('data-wake-releases', '1');
  await button(page, 'Resume timer').click();
  await expect(html).toHaveAttribute('data-wake-locks', '2');
  await page.clock.setFixedTime(new Date(testInstant.getTime() + 605_000));
  await expect(page.getByRole('timer')).toHaveText('+00:05');
  await expect(html).toHaveAttribute('data-vibrations', '2');
  await expect(html).toHaveAttribute('data-tones', '4');
  await button(page, 'Mark done & next').click();
  await expect(page.getByRole('timer', { name: 'Rest remaining' })).toHaveText('00:30');
  await expect(html).toHaveAttribute('data-wake-locks', '3');
  await page.screenshot({ path: info.outputPath('rest-mobile.png'), scale: 'css' });

  await page.clock.setFixedTime(new Date(testInstant.getTime() + 636_000));
  await expect(page.getByText('Rest complete', { exact: true })).toBeVisible();
  await expect(html).toHaveAttribute('data-vibrations', '3');
  await expect(html).toHaveAttribute('data-tones', '6');
  await expect(html).toHaveAttribute('data-wake-releases', '3');
  await expect(page.getByRole('heading', { name: 'Stationary cycling', exact: true })).toHaveCount(0);
  await button(page, 'Start next now').click();
  await expect(page.getByRole('timer')).toHaveText('08:00');
  await expect(html).toHaveAttribute('data-vibrations', '3');
});

test('Progress shows time by category and exercise stats from saved workout details', async ({ page }, info) => {
  await onBoard(page, '2026-11-20');
  await button(page, 'Start workout').click();
  await page.getByText('Log cardio details', { exact: true }).click();
  await page.getByLabel('Actual minutes').fill('6.5');
  await page.getByLabel('Distance (km)').fill('1.25');
  await page.getByLabel('Speed (km/h)').fill('6.2');
  await button(page, 'Save cardio details').click();
  await expect(page.getByText('Saved', { exact: true })).toBeVisible();
  await setLocalTime(page, new Date(testInstant.getTime() + 6 * 60_000));
  await completeAndAdvance(page);
  await expect(page.getByRole('heading', { name: 'Stationary cycling', exact: true })).toBeVisible();
  await setLocalTime(page, new Date(testInstant.getTime() + 14 * 60_000));
  await completeAndAdvance(page);
  await expect(page.getByRole('heading', { name: 'Chest press machine', exact: true })).toBeVisible();

  await page.getByText('Log sets', { exact: true }).click();
  const firstSet = page.locator('.fit-player-set').first();
  await firstSet.getByLabel('Reps', { exact: true }).fill('8');
  await firstSet.getByLabel('Weight (kg)').fill('22.5');
  await button(page, 'Mark set 1 done').click();
  await expect(button(page, 'Update set 1')).toBeVisible();
  await setLocalTime(page, new Date(testInstant.getTime() + 17 * 60_000));
  await completeAndAdvance(page);
  await expect(page.getByRole('heading', { name: 'Forearm plank (or knee plank)' })).toBeVisible();

  await page.getByText('Log sets', { exact: true }).click();
  await firstSet.getByLabel('Hold (sec)').fill('24');
  await button(page, 'Mark set 1 done').click();
  await expect(button(page, 'Update set 1')).toBeVisible();
  await setLocalTime(page, new Date(testInstant.getTime() + 20 * 60_000));
  await completeAndAdvance(page);
  await expect(page.getByRole('heading', { name: 'Gentle cooldown and stretches' })).toBeVisible();
  await setLocalTime(page, new Date(testInstant.getTime() + 21 * 60_000));
  await button(page, 'Mark done & review').click();
  await button(page, 'Finish workout').click();
  await expect(button(page, 'View workout')).toBeVisible();

  await page.setViewportSize({ width: 360, height: 780 });
  await tab(page, 'Progress');
  const loggedActivity = page.getByRole('region', { name: 'Logged activity' });
  await expect(loggedActivity.getByText('21 min 30 sec')).toBeVisible();
  await expect(loggedActivity.getByText('Cardio')).toBeVisible();
  await expect(loggedActivity.getByText('Strength')).toBeVisible();
  await expect(loggedActivity.getByText('Core & glutes')).toBeVisible();

  const analytics = page.getByRole('region', { name: 'Exercise analytics' });
  const selected = analytics.getByRole('combobox', { name: 'Exercise' });
  await expect(analytics.getByText('1.25 km', { exact: true })).toBeVisible();
  await expect(analytics.getByText('6.2 km/h', { exact: true })).toBeVisible();
  await selected.selectOption('chest_press_machine');
  await expect(analytics.getByText('Heaviest logged load')).toBeVisible();
  await expect(analytics.getByText('22.5 kg', { exact: true })).toBeVisible();
  await expect(analytics.getByRole('list', { name: 'Recent workouts' })).toContainText('1 set · 8 reps · 22.5 kg heaviest');
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);

  await page.setViewportSize({ width: 1280, height: 920 });
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.screenshot({ path: info.outputPath('exercise-analytics.png'), scale: 'css' });

  await selected.selectOption('plank');
  await expect(analytics.getByText('24 sec', { exact: true })).toBeVisible();
  await expect(analytics.getByText('Logged reps', { exact: true })).toHaveCount(0);
  await setLocalTime(page, new Date('2026-11-27T09:30:00Z'));
  await button(page, 'Last 7 days').click();
  await expect(analytics.getByText(/No completed entries for this exercise/)).toBeVisible();
  await button(page, 'Program so far').click();
  await expect(analytics.getByText('24 sec', { exact: true })).toBeVisible();
});

test('mobile tabs fit 360px and a saved workout resumes across a local date boundary', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await onBoard(page, '2026-11-20');
  await expect(page.getByText('Day 1 of 30')).toBeVisible();
  await setLocalTime(page, new Date('2026-11-20T18:30:01Z'));
  await expect(page.getByText('Day 1 of 30')).toBeVisible();
  await button(page, 'Start today’s workout').click();
  await expect(page.getByText('Workout · Day 2', { exact: true })).toBeVisible();
  await button(page, 'Mark done & next').click();
  await button(page, 'Exit workout').click();
  await button(page, 'Save partial').click();
  await expect(page.getByText('Day 2 of 30')).toBeVisible();
  await setLocalTime(page, new Date('2026-11-21T18:30:01Z'));
  await page.reload();
  await expect(button(page, 'Resume workout')).toBeVisible();
  for (const name of ['Today', 'Calendar', 'Progress', 'Settings'] as const) {
    await tab(page, name);
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const bounds = await page.getByRole('button', { name, exact: true }).boundingBox();
    expect(bounds?.height).toBeGreaterThanOrEqual(44);
  }
  await tab(page, 'Today');
  await button(page, 'Resume workout').click();
  await button(page, 'Start next now').click();
  await expect(page.getByRole('heading', { name: 'Stationary cycling' })).toBeVisible();
});

test('desktop keeps the plan and week summary side by side', async ({ page }, info) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await onBoard(page, '2026-11-20');
  const plan = await page.getByRole('heading', { name: 'Push + front-core', exact: true }).boundingBox();
  const week = await page.getByRole('heading', { name: 'This week', exact: true }).boundingBox();
  expect(plan).toBeTruthy();
  expect(week).toBeTruthy();
  expect(week!.x).toBeGreaterThan(plan!.x + plan!.width);
  await page.screenshot({ path: info.outputPath('today-desktop.png'), scale: 'css' });
});
