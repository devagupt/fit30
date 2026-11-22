import { Activity, CalendarDays, ChartNoAxesColumnIncreasing, House, RefreshCw, Settings, WifiOff } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useFit30Data } from './data/useFit30Data';
import { localDate } from './domain/dates';
import { newId } from './domain/model';
import { activeWorkout, createSession, updateSession, type WorkoutAction } from './domain/workout';
import { Onboarding } from './features/onboarding/Onboarding';
import { TutorialDialog } from './features/player/TutorialDialog';
import { WorkoutPlayer } from './features/player/WorkoutPlayer';
import { prepareTimerSound } from './features/player/timerAlert';
import { TodayScreen } from './features/today/TodayScreen';
import { useConnection } from './ui/useConnection';

const sections = [
  { id: 'today', label: 'Today', icon: House },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays },
  { id: 'progress', label: 'Progress', icon: ChartNoAxesColumnIncreasing },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const;

const CalendarScreen = lazy(() => import('./features/calendar/CalendarScreen').then(({ CalendarScreen }) => ({ default: CalendarScreen })));
const ProgressScreen = lazy(() => import('./features/progress/ProgressScreen').then(({ ProgressScreen }) => ({ default: ProgressScreen })));
const SettingsScreen = lazy(() => import('./features/settings/SettingsScreen').then(({ SettingsScreen }) => ({ default: SettingsScreen })));

type Tab = (typeof sections)[number]['id'];

function useToday(timezone: string) {
  const [, setClock] = useState(Date.now);
  useEffect(() => {
    const update = () => setClock(Date.now());
    const interval = window.setInterval(update, 15_000);
    window.addEventListener('focus', update);
    document.addEventListener('visibilitychange', update);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', update);
      document.removeEventListener('visibilitychange', update);
    };
  }, []);
  return localDate(timezone);
}

function Navigation({ current, onChange, mobile = false }: { current: Tab; onChange: (tab: Tab) => void; mobile?: boolean }) {
  return (
    <nav className={mobile ? 'app-nav app-nav-mobile' : 'app-nav app-nav-desktop'} aria-label="Main navigation">
      {sections.map(({ id, label, icon: Icon }) => (
        <button type="button" key={id} aria-current={id === current ? 'page' : undefined} onClick={() => onChange(id)}>
          <Icon size={mobile ? 21 : 18} aria-hidden="true" /><span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

export function App() {
  const { data, error, isSaving, commit, reload } = useFit30Data();
  const { online, offlineStatus, appInstalled, install, retryOffline } = useConnection();
  const [tab, setTab] = useState<Tab>('today');
  const [calendarDay, setCalendarDay] = useState<number>();
  const [playerId, setPlayerId] = useState<string | null>();
  const [tutorialId, setTutorialId] = useState<string | null>(null);
  const [measurementRequested, setMeasurementRequested] = useState(false);
  const [starting, setStarting] = useState(false);
  const startLock = useRef(false);
  const main = useRef<HTMLElement>(null);
  const run = data?.runs.find((entry) => entry.id === data.activeRunId);
  const savedWorkout = data ? activeWorkout(data) : undefined;
  const playerSession = playerId === undefined || playerId === savedWorkout?.id ? savedWorkout : undefined;
  const today = useToday(run?.timezone ?? data?.preferences.timezone ?? 'Asia/Kolkata');

  useEffect(() => {
    if (data && playerId === undefined) setPlayerId(savedWorkout?.id ?? null);
  }, [data, playerId, savedWorkout?.id]);

  function focusContent() {
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0 });
      main.current?.focus({ preventScroll: true });
    });
  }

  function navigate(next: Tab, measure = false) {
    setMeasurementRequested(measure);
    setCalendarDay(undefined);
    setTab(next);
    focusContent();
  }

  async function beginWorkout(dayNumber: number, sessionId?: string) {
    if (!run || !data || startLock.current || isSaving) return;
    if (data.preferences.sound) void prepareTimerSound();
    startLock.current = true;
    setStarting(true);
    let selectedId = sessionId ?? newId();
    const now = Date.now();
    try {
      const saved = await commit((source) => {
        const active = source.runs.find((entry) => entry.id === source.activeRunId);
        if (!active || active.id !== run.id) throw new Error('The active program changed. Please try again.');
        const candidates = source.sessions.filter((session) => session.programRunId === active.id && session.plannedDayNumber === dayNumber &&
          (session.status === 'in_progress' || session.status === 'partial'));
        const existing = sessionId ? candidates.find((entry) => entry.id === sessionId) : candidates.find((entry) => entry.status === 'in_progress');
        if (sessionId && !existing) throw new Error('This workout has already changed. Choose an available session.');
        if (existing) selectedId = existing.id;
        const sessions = source.sessions.map((session) => {
          if (session.id === existing?.id) return updateSession(session, { type: 'resume' }, now);
          return session.status === 'in_progress' ? updateSession(session, { type: 'savePartial' }, now) : session;
        });
        if (!existing) sessions.push(createSession(active, dayNumber, now, selectedId));
        return { ...source, sessions };
      });
      if (saved) setPlayerId(selectedId);
    } finally {
      startLock.current = false;
      setStarting(false);
    }
  }

  function workoutAction(actions: WorkoutAction | WorkoutAction[], quiet = false) {
    if (!playerSession) return Promise.resolve(false);
    const now = Date.now();
    const changes = Array.isArray(actions) ? actions : [actions];
    return commit((current) => {
      const original = activeWorkout(current);
      if (original?.id !== playerSession.id || original.position !== playerSession.position ||
        original.restUntilMs !== playerSession.restUntilMs ||
        original.exercises[original.position]?.exerciseId !== playerSession.exercises[playerSession.position]?.exerciseId) {
        if (quiet) return current;
        throw new Error('This workout changed in another window. Review the current exercise and try again.');
      }
      const updated = changes.reduce((session, action) => updateSession(session, action, now), original);
      if (updated === original) return current;
      return { ...current, sessions: current.sessions.map((entry) => entry.id === original.id ? updated : entry) };
    }, { latest: true, quiet: true });
  }

  function leaveWorkout() {
    setPlayerId(null);
    focusContent();
  }

  const busy = isSaving || starting;
  const withNav = !!run && !playerSession;

  return (
    <div className={`app${withNav ? ' app-with-nav' : ''}${playerSession ? ' app-with-player' : ''}`}>
      <a href="#fit30-main" className="skip-link">Skip to content</a>
      <header className="app-header">
        <div className="app-header-content">
          <button type="button" className="brand" onClick={() => navigate('today')} disabled={!withNav} aria-label="Fit30 home">
            <span className="brand-mark"><Activity size={23} aria-hidden="true" /></span>
            <span>Fit<span className="brand-number">30</span></span>
          </button>
          {withNav && <Navigation current={tab} onChange={navigate} />}
          {!online && <span role="status" className="app-offline"><WifiOff size={17} aria-hidden="true" /> Offline</span>}
        </div>
      </header>
      <main ref={main} id="fit30-main" tabIndex={-1} className="app-content">
        {error && (
          <div className="app-save-error" role="alert">
            <p>{error}</p>
            {!data && <button type="button" className="button button-secondary" onClick={() => void reload()}><RefreshCw size={16} aria-hidden="true" /> Try again</button>}
          </div>
        )}
        <Suspense fallback={<p role="status" className="app-loading">Opening Fit30…</p>}>
          {!data ? (
            !error && <p role="status" className="app-loading">Opening Fit30…</p>
          ) : !run ? (
            <Onboarding data={data} onSave={commit} busy={busy} />
          ) : playerSession ? (
            <WorkoutPlayer key={playerSession.id} session={playerSession} preferences={data.preferences} onAction={workoutAction} onExit={leaveWorkout} />
          ) : tab === 'calendar' ? (
            <CalendarScreen key={`${run.id}:${calendarDay ?? 'today'}`} data={data} run={run} today={today} initialDay={calendarDay}
              onStart={(day, id) => void beginWorkout(day, id)} onTutorial={setTutorialId} />
          ) : tab === 'progress' ? (
            <ProgressScreen key={`${run.id}:${measurementRequested}`} data={data} run={run} today={today} onSave={commit} busy={busy} initialMeasurement={measurementRequested} />
          ) : tab === 'settings' ? (
            <SettingsScreen key={run.id} data={data} run={run} offlineStatus={offlineStatus} appInstalled={appInstalled}
              onInstall={install} onRetryOffline={retryOffline} onSave={commit} busy={busy} />
          ) : (
            <TodayScreen data={data} run={run} today={today} busy={busy} onStart={(day, id) => void beginWorkout(day, id)}
              onCalendar={(day) => { navigate('calendar'); setCalendarDay(day); }} onMeasurement={() => navigate('progress', true)} onTutorial={setTutorialId} />
          )}
        </Suspense>
      </main>
      {withNav && <Navigation current={tab} onChange={navigate} mobile />}
      {tutorialId && <TutorialDialog exerciseId={tutorialId} onClose={() => setTutorialId(null)} />}
    </div>
  );
}
