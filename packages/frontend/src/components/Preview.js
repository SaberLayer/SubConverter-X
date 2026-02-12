import { jsxs as _jsxs, jsx as _jsx } from "react/jsx-runtime";
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
export default function Preview({ output, nodeCount, skipped, filteredOut, target }) {
    const { t } = useTranslation();
    const [copied, setCopied] = useState(false);
    const handleCopy = async () => {
        await navigator.clipboard.writeText(output);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (_jsxs("div", { className: "space-y-2", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("div", { className: "text-sm text-gray-600 dark:text-gray-400", children: [t('result.nodeCount', { count: nodeCount }), filteredOut ? (_jsxs("span", { className: "ml-2 text-blue-600 dark:text-blue-400", children: ["(", filteredOut, " ", t('advanced.nodeFilter'), ")"] })) : null, skipped.length > 0 && (_jsxs("span", { className: "ml-2 text-yellow-600 dark:text-yellow-400", children: ["(", skipped.length, " ", t('error.unsupportedProtocol', { protocol: '' }), ")"] }))] }), _jsx("button", { onClick: handleCopy, className: "px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors", children: copied ? t('common.copied') : t('common.copy') })] }), _jsx("pre", { className: "w-full max-h-96 overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-xs font-mono whitespace-pre-wrap break-all", children: output })] }));
}
