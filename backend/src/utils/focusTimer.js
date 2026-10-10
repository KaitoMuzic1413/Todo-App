const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

export const getElapsedSeconds = (session, now = new Date()) => {
  const storedElapsed = Number(session.elapsedSeconds) || 0;
  const currentSegment = session.status === 'running' && session.segmentStartedAt
    ? Math.floor((now.getTime() - new Date(session.segmentStartedAt).getTime()) / 1000)
    : 0;
  return clamp(storedElapsed + Math.max(0, currentSegment), 0, session.durationSeconds);
};

export const getRemainingSeconds = (session, now = new Date()) => {
  if (session.status === 'running' && session.endsAt) {
    return clamp(Math.ceil((new Date(session.endsAt).getTime() - now.getTime()) / 1000), 0, session.durationSeconds);
  }
  return clamp(Number(session.remainingSeconds) || 0, 0, session.durationSeconds);
};