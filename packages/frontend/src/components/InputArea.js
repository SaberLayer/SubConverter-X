import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
export default function InputArea({ value, onChange }) {
    const { t } = useTranslation();
    const handleDrop = useCallback((e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => onChange(reader.result);
            reader.readAsText(file);
        }
    }, [onChange]);
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1.5", children: t('input.title') }), _jsx("textarea", { value: value, onChange: (e) => onChange(e.target.value), onDrop: handleDrop, onDragOver: (e) => e.preventDefault(), placeholder: t('input.placeholder'), rows: 8, className: "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y" })] }));
}
