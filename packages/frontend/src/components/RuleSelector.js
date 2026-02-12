import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRules } from '../api';
export default function RuleSelector({ value, onChange }) {
    const { t } = useTranslation();
    const [rules, setRules] = useState([]);
    useEffect(() => {
        getRules().then(setRules).catch(() => { });
    }, []);
    return (_jsxs("div", { children: [_jsx("label", { className: "block text-sm font-medium mb-1.5", children: t('advanced.ruleProvider') }), _jsx("select", { value: value, onChange: (e) => onChange(e.target.value), className: "w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500", children: rules.map((r) => (_jsx("option", { value: r.id, title: r.description, children: r.name }, r.id))) })] }));
}
