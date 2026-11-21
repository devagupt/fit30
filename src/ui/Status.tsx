import type { DayStatus } from '../domain/progress';

export const dayStatusText: Record<DayStatus, string> = {
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  partial: 'Partial',
  completed: 'Completed',
  completed_with_skips: 'Completed with skips',
  missed: 'Not logged',
  rest: 'Rest',
};

export function Status({ status }: { status: DayStatus }) {
  return <span className="status-chip" data-status={status}>{dayStatusText[status]}</span>;
}
