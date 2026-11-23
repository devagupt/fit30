import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { Fit30Data } from '../../domain/model';
import { isWorkoutReminderId, workoutReminders } from '../../domain/reminders';

export const isPhoneApp = Capacitor.isNativePlatform();
export const isAndroidApp = Capacitor.getPlatform() === 'android';

export type DeviceReminderStatus =
  | { kind: 'off' | 'checking' | 'permission' | 'empty' | 'error' }
  | { kind: 'scheduled'; nextAt: number; exact: boolean };

let updating = Promise.resolve();

export async function allowReminderNotifications(): Promise<boolean> {
  const permission = await LocalNotifications.checkPermissions();
  const result = permission.display === 'granted' ? permission : await LocalNotifications.requestPermissions();
  return result.display === 'granted' && (await LocalNotifications.areEnabled()).value;
}

export async function openExactReminderSettings() {
  await LocalNotifications.changeExactNotificationSetting();
}

async function applyReminderSchedule(data: Fit30Data): Promise<DeviceReminderStatus> {
  const pending = (await LocalNotifications.getPending()).notifications.filter(({ id }) => isWorkoutReminderId(id));
  const reminders = workoutReminders(data);
  const permitted = reminders.length > 0 && (await LocalNotifications.checkPermissions()).display === 'granted'
    && (await LocalNotifications.areEnabled()).value;
  const desiredIds = new Set(permitted ? reminders.map(({ id }) => id) : []);
  const obsolete = pending.filter(({ id }) => !desiredIds.has(id)).map(({ id }) => ({ id }));
  if (obsolete.length) await LocalNotifications.cancel({ notifications: obsolete });

  if (!data.preferences.remindersEnabled) return { kind: 'off' };
  if (!reminders.length) return { kind: 'empty' };
  if (!permitted) return { kind: 'permission' };

  const exact = !isAndroidApp || (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === 'granted';
  const byId = new Map(pending.map((reminder) => [reminder.id, reminder]));
  const changes = reminders.filter(({ id, at, body }) => {
    const current = byId.get(id);
    return current?.extra?.fit30At !== at || current?.extra?.fit30Exact !== exact || current?.body !== body;
  });

  if (changes.length) {
    await LocalNotifications.schedule({ notifications: changes.map(({ id, at, body }) => ({
      id,
      title: 'Fit30',
      body,
      schedule: { at: new Date(at), allowWhileIdle: true },
      isExactNotification: exact,
      extra: { fit30At: at, fit30Exact: exact },
    })) });
  }

  return { kind: 'scheduled', nextAt: reminders[0].at, exact };
}

export function syncDeviceReminders(data: Fit30Data): Promise<DeviceReminderStatus> {
  const work = updating.then(() => applyReminderSchedule(data));
  updating = work.then(() => undefined, () => undefined);
  return work;
}
