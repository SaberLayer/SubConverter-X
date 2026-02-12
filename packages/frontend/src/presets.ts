// Configuration preset management using localStorage

export interface ConfigPreset {
  id: string;
  name: string;
  config: {
    target: string;
    ruleTemplate: string;
    include: string;
    exclude: string;
    rename: string;
    addEmoji: boolean;
    deduplicate: boolean;
    sort: 'none' | 'name' | 'region';
    enableUdp?: boolean;
    skipCertVerify?: boolean;
    autoRegionGroup: boolean;
  };
  createdAt: number;
}

const STORAGE_KEY = 'subconverter_presets';

export function getPresets(): ConfigPreset[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function savePreset(preset: Omit<ConfigPreset, 'id' | 'createdAt'>): ConfigPreset {
  const presets = getPresets();
  const newPreset: ConfigPreset = {
    ...preset,
    id: Date.now().toString(36) + Math.random().toString(36).substr(2),
    createdAt: Date.now(),
  };
  presets.push(newPreset);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  return newPreset;
}

export function deletePreset(id: string): void {
  const presets = getPresets().filter(p => p.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function updatePreset(id: string, updates: Partial<ConfigPreset>): void {
  const presets = getPresets();
  const index = presets.findIndex(p => p.id === id);
  if (index !== -1) {
    presets[index] = { ...presets[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
  }
}
