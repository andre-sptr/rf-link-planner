export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const STORAGE_KEY = 'linksight-color-scheme';

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return 'light';
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function getStoredThemePreference(): ThemePreference {
  try {
    const val = window.localStorage.getItem(STORAGE_KEY);
    if (val === 'light' || val === 'dark') {
      return val;
    }
  } catch {
    // ignore storage errors
  }
  return 'system';
}

export function resolveActiveTheme(): ResolvedTheme {
  const pref = getStoredThemePreference();
  return pref === 'system' ? getSystemTheme() : pref;
}

export function applyMetaColorScheme(pref: ThemePreference): void {
  const meta = document.querySelector('meta[name="color-scheme"]');
  if (meta) {
    meta.setAttribute('content', pref === 'system' ? 'light dark' : pref);
  }
}

/**
 * Two-state toggle rule (modern-web-guidance dark-mode-toggle):
 * Target is opposite of currently rendered scheme. If target matches OS preference,
 * remove stored override so site reverts to system; otherwise persist literal 'light' | 'dark'.
 */
export function toggleColorScheme(): ResolvedTheme {
  const currentRendered = resolveActiveTheme();
  const target: ResolvedTheme = currentRendered === 'dark' ? 'light' : 'dark';
  const systemTheme = getSystemTheme();

  try {
    if (target === systemTheme) {
      window.localStorage.removeItem(STORAGE_KEY);
      applyMetaColorScheme('system');
    } else {
      window.localStorage.setItem(STORAGE_KEY, target);
      applyMetaColorScheme(target);
    }
  } catch {
    applyMetaColorScheme(target);
  }

  return target;
}

export function subscribeThemeChanges(
  onChange: (resolved: ResolvedTheme, pref: ThemePreference) => void,
): () => void {
  const emit = () => {
    const pref = getStoredThemePreference();
    applyMetaColorScheme(pref);
    onChange(pref === 'system' ? getSystemTheme() : pref, pref);
  };

  const media = window.matchMedia?.('(prefers-color-scheme: dark)');
  const onMediaChange = () => emit();
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === STORAGE_KEY) {
      emit();
    }
  };

  media?.addEventListener('change', onMediaChange);
  window.addEventListener('storage', onStorage);

  return () => {
    media?.removeEventListener('change', onMediaChange);
    window.removeEventListener('storage', onStorage);
  };
}
