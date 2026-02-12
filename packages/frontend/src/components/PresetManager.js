import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getPresets, savePreset, deletePreset } from '../presets';
export default function PresetManager({ currentConfig, onLoadPreset }) {
    const { t } = useTranslation();
    const [presets, setPresets] = useState([]);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [presetName, setPresetName] = useState('');
    useEffect(() => {
        setPresets(getPresets());
    }, []);
    const handleSave = () => {
        if (!presetName.trim())
            return;
        const newPreset = savePreset({
            name: presetName.trim(),
            config: currentConfig,
        });
        setPresets([...presets, newPreset]);
        setPresetName('');
        setShowSaveDialog(false);
    };
    const handleDelete = (id) => {
        if (confirm(t('preset.deleteConfirm', { name: presets.find(p => p.id === id)?.name }))) {
            deletePreset(id);
            setPresets(presets.filter(p => p.id !== id));
        }
    };
    const handleLoad = (preset) => {
        onLoadPreset(preset.config);
    };
    return (_jsxs("div", { className: "border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-sm font-semibold text-gray-700 dark:text-gray-300", children: t('preset.title') }), _jsx("button", { onClick: () => setShowSaveDialog(true), className: "px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors", children: t('preset.save') })] }), showSaveDialog && (_jsxs("div", { className: "p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg space-y-2", children: [_jsx("input", { type: "text", value: presetName, onChange: (e) => setPresetName(e.target.value), placeholder: t('preset.namePlaceholder'), className: "w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", onKeyDown: (e) => e.key === 'Enter' && handleSave() }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: handleSave, disabled: !presetName.trim(), className: "px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors", children: t('common.save') }), _jsx("button", { onClick: () => {
                                    setShowSaveDialog(false);
                                    setPresetName('');
                                }, className: "px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-md transition-colors", children: t('common.cancel') })] })] })), presets.length === 0 ? (_jsx("p", { className: "text-xs text-gray-500 dark:text-gray-400 text-center py-2", children: t('preset.title') })) : (_jsx("div", { className: "space-y-2", children: presets.map((preset) => (_jsxs("div", { className: "flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-md hover:bg-gray-100 dark:hover:bg-gray-750 transition-colors", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "text-sm font-medium text-gray-700 dark:text-gray-300 truncate", children: preset.name }), _jsx("p", { className: "text-xs text-gray-500 dark:text-gray-400", children: new Date(preset.createdAt).toLocaleDateString() })] }), _jsxs("div", { className: "flex gap-2 ml-2", children: [_jsx("button", { onClick: () => handleLoad(preset), className: "px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors", children: t('preset.load') }), _jsx("button", { onClick: () => handleDelete(preset.id), className: "px-2 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded transition-colors", children: t('common.delete') })] })] }, preset.id))) }))] }));
}
