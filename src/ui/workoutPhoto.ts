export function workoutPhoto(dayNumber: number): string {
  const day = String(dayNumber).padStart(2, '0');
  return `${import.meta.env.BASE_URL}workout-photos/day-${day}.webp`;
}
