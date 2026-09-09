export const formatDuration = (ms: number | null) => {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return "—";
  const totalMinutes = Math.round(ms / 60_000);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 48) return minutes ? `${hours} h ${minutes} min` : `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} d`;
};
