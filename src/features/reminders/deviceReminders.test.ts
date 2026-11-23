import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LocalNotificationSchema } from '@capacitor/local-notifications';
import { emptyData } from '../../domain/model';
import { startProgram } from '../../domain/workout';
import { syncDeviceReminders } from './deviceReminders';

const plugin = vi.hoisted(() => ({
  getPending: vi.fn(),
  checkPermissions: vi.fn(),
  areEnabled: vi.fn(),
  checkExactNotificationSetting: vi.fn(),
  cancel: vi.fn(),
  schedule: vi.fn(),
  requestPermissions: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } }));
vi.mock('@capacitor/local-notifications', () => ({ LocalNotifications: plugin }));

const scheduledAt = Date.parse('2026-11-20T13:00:00Z');
let pending: Map<number, LocalNotificationSchema>;

function activeData() {
  const data = startProgram(emptyData, '2026-11-20', 'Asia/Kolkata', Date.now(), 'reminder-test');
  return { ...data, preferences: { ...data.preferences, remindersEnabled: true, reminderTime: '18:30' } };
}

describe('device notifications', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T08:00:00Z'));
    pending = new Map();
    plugin.getPending.mockImplementation(async () => ({ notifications: [...pending.values()] }));
    plugin.checkPermissions.mockResolvedValue({ display: 'granted' });
    plugin.areEnabled.mockResolvedValue({ value: true });
    plugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'denied' });
    plugin.schedule.mockImplementation(async ({ notifications }: { notifications: LocalNotificationSchema[] }) => {
      for (const notification of notifications) pending.set(notification.id, notification);
    });
    plugin.cancel.mockImplementation(async ({ notifications }: { notifications: { id: number }[] }) => {
      for (const { id } of notifications) pending.delete(id);
    });
  });

  afterEach(() => vi.useRealTimers());

  it('queues the full offline schedule once and updates timing after exact permission changes', async () => {
    const data = activeData();
    expect(await syncDeviceReminders(data)).toEqual({ kind: 'scheduled', nextAt: scheduledAt, exact: false });
    expect(pending.size).toBe(26);
    expect(pending.get(3001)).toMatchObject({
      schedule: { at: new Date(scheduledAt), allowWhileIdle: true }, isExactNotification: false,
    });
    await syncDeviceReminders(data);
    expect(plugin.schedule).toHaveBeenCalledTimes(1);

    plugin.checkExactNotificationSetting.mockResolvedValue({ exact_alarm: 'granted' });
    await syncDeviceReminders(data);
    expect(pending.get(3001)?.isExactNotification).toBe(true);
    expect(pending.size).toBe(26);
  });

  it('removes Fit30 reminders when turned off or permission is revoked', async () => {
    const data = activeData();
    pending.set(19, { id: 19, title: 'Other alert', body: 'Separate notification' });
    await syncDeviceReminders(data);
    plugin.areEnabled.mockResolvedValue({ value: false });
    expect(await syncDeviceReminders(data)).toEqual({ kind: 'permission' });
    expect([...pending.keys()]).toEqual([19]);
    expect(plugin.requestPermissions).not.toHaveBeenCalled();

    plugin.areEnabled.mockResolvedValue({ value: true });
    await syncDeviceReminders(data);
    data.preferences.remindersEnabled = false;
    expect(await syncDeviceReminders(data)).toEqual({ kind: 'off' });
    expect([...pending.keys()]).toEqual([19]);
  });
});
