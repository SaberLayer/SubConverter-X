import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getPresets, savePreset, deletePreset, ConfigPreset } from '../presets';

interface Props {
  currentConfig: {
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
  onLoadPreset: (config: ConfigPreset['config']) => void;
}

export default function PresetManager({ currentConfig, onLoadPreset }: Props) {
  const { t } = useTranslation();
  const [presets, setPresets] = useState<ConfigPreset[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    setPresets(getPresets());
  }, []);

  const handleSave = () => {
    if (!presetName.trim()) return;
    const newPreset = savePreset({
      name: presetName.trim(),
      config: currentConfig,
    });
    setPresets([...presets, newPreset]);
    setPresetName('');
    setShowSaveDialog(false);
  };

  const handleDelete = (id: string) => {
    if (confirm(t('preset.deleteConfirm', { name: presets.find(p => p.id === id)?.name }))) {
      deletePreset(id);
      setPresets(presets.filter(p => p.id !== id));
    }
  };

  const handleLoad = (preset: ConfigPreset) => {
    onLoadPreset(preset.config);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('preset.title')}</h3>
        <button
          onClick={() => setShowSaveDialog(true)}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
        >
          {t('preset.save')}
        </button>
      </div>

      {showSaveDialog && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder={t('preset.namePlaceholder')}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!presetName.trim()}
              className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
            >
              {t('common.save')}
            </button>
            <button
              onClick={() => {
                setShowSaveDialog(false);
                setPresetName('');
              }}
              className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      )}

      {presets.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
          {t('preset.title')}
        </p>
      ) : (
        <div className="space-y-2">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">
                  {preset.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(preset.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2 ml-2">
                <button
                  onClick={() => handleLoad(preset)}
                  className="px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                >
                  {t('preset.load')}
                </button>
                <button
                  onClick={() => handleDelete(preset.id)}
                  className="px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                >
                  {t('common.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
