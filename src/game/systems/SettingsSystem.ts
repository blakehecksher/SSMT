import { SETTINGS_KEY } from '../constants';

export interface GameSettings {
  screenShake: boolean;
  scanlines: boolean;
  /** iPadOS-style morphing cursor overlay. Set false to disable entirely. */
  ipadCursor: boolean;
}

const DEFAULT_SETTINGS: GameSettings = {
  screenShake: true,
  scanlines: true,
  ipadCursor: true,
};

let cachedSettings: GameSettings | null = null;

function load(): GameSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameSettings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Private browsing or corrupted data
  }
  return { ...DEFAULT_SETTINGS };
}

function save(settings: GameSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Private browsing
  }
}

export function getSettings(): GameSettings {
  if (!cachedSettings) {
    cachedSettings = load();
  }
  return cachedSettings;
}

export function updateSettings(partial: Partial<GameSettings>): GameSettings {
  const settings = getSettings();
  Object.assign(settings, partial);
  cachedSettings = settings;
  save(settings);
  return settings;
}
