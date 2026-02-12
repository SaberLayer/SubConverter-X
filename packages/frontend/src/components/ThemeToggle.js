import { jsx as _jsx } from "react/jsx-runtime";
import { useEffect, useState } from 'react';
export default function ThemeToggle() {
    const [dark, setDark] = useState(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('theme') === 'dark' ||
                (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
        }
        return false;
    });
    useEffect(() => {
        document.documentElement.classList.toggle('dark', dark);
        localStorage.setItem('theme', dark ? 'dark' : 'light');
    }, [dark]);
    return (_jsx("button", { onClick: () => setDark(!dark), className: "p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm", "aria-label": "Toggle theme", children: dark ? '☀ 浅色' : '☾ 深色' }));
}
