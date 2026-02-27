export interface EscapeLogEntry {
  timeMs: number;
  timestamp: string;
}

const STORAGE_KEY = 'xcaper.escapeLog.v1';
const MAX_LOG_ENTRIES_PER_LEVEL = 5;

const createEmptyLog = (levelCount: number): EscapeLogEntry[][] =>
  Array.from({ length: levelCount }, () => []);

const isValidEntry = (value: unknown): value is EscapeLogEntry => {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const entry = value as Partial<EscapeLogEntry>;
  return (
    typeof entry.timeMs === 'number' &&
    Number.isFinite(entry.timeMs) &&
    entry.timeMs >= 0 &&
    typeof entry.timestamp === 'string' &&
    Number.isFinite(Date.parse(entry.timestamp))
  );
};

export const getEscapeLog = (levelCount: number): EscapeLogEntry[][] => {
  const empty = createEmptyLog(levelCount);
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return empty;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return empty;
    }

    const normalized = createEmptyLog(levelCount);
    for (let i = 0; i < levelCount; i += 1) {
      const levelEntriesRaw = parsed[i];
      if (!Array.isArray(levelEntriesRaw)) {
        continue;
      }

      const validEntries = levelEntriesRaw
        .filter((entry) => isValidEntry(entry))
        .sort((a, b) => a.timeMs - b.timeMs)
        .slice(0, MAX_LOG_ENTRIES_PER_LEVEL);

      normalized[i] = validEntries;
    }

    return normalized;
  } catch {
    return empty;
  }
};

export const recordEscapeLogEntry = (params: {
  levelNumber: number;
  timeMs: number;
  levelCount: number;
  timestamp?: Date;
}): EscapeLogEntry[][] => {
  const levelIndex = params.levelNumber - 1;
  const logs = getEscapeLog(params.levelCount);

  if (levelIndex < 0 || levelIndex >= params.levelCount || !Number.isFinite(params.timeMs) || params.timeMs < 0) {
    return logs;
  }

  const entry: EscapeLogEntry = {
    timeMs: params.timeMs,
    timestamp: (params.timestamp ?? new Date()).toISOString()
  };

  logs[levelIndex] = [...logs[levelIndex], entry]
    .sort((a, b) => a.timeMs - b.timeMs)
    .slice(0, MAX_LOG_ENTRIES_PER_LEVEL);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(logs));
  return logs;
};
