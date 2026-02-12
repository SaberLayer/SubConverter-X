import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslation } from 'react-i18next';
const formats = [
    { id: 'clash-meta', label: 'Clash Meta / mihomo' },
    { id: 'singbox', label: 'sing-box' },
    { id: 'surge', label: 'Surge 5' },
    { id: 'quantumultx', label: 'Quantumult X' },
    { id: 'shadowrocket', label: 'Shadowrocket' },
    { id: 'loon', label: 'Loon' },
    { id: 'v2ray', label: 'V2Ray / Xray' },
    { id: 'base64', label: 'Base64 URI' },
];
export default function FormatSelector({ value, onChange }) {
    const { t } = useTranslation();
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1.5", children: t('output.title') }), _jsx("select", { value: value, onChange: (e) => onChange(e.target.value), className: "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: formats.map((f) => (_jsx("option", { value: f.id, children: f.label }, f.id))) })] }));
}
