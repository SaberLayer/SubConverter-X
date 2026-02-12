// Configuration preset management using localStorage
const STORAGE_KEY = 'subconverter_presets';
export function getPresets() {
    try {
        const data = localStorage.getItem(STORAGE_KEY);
        if (!data)
            return [];
        return JSON.parse(data);
    }
    catch {
        return [];
    }
}
export function savePreset(preset) {
    const presets = getPresets();
    const newPreset = {
        ...preset,
        id: Date.now().toString(36) + Math.random().toString(36).substr(2),
        createdAt: Date.now(),
    };
    presets.push(newPreset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    return newPreset;
}
export function deletePreset(id) {
    const presets = getPresets().filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}
export function updatePreset(id, updates) {
    const presets = getPresets();
    const index = presets.findIndex(p => p.id === id);
    if (index !== -1) {
        presets[index] = { ...presets[index], ...updates };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
    }
}
