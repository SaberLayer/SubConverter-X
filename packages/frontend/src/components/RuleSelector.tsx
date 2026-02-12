import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getRules, RuleInfo } from '../api';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function RuleSelector({ value, onChange }: Props) {
  const { t } = useTranslation();
  const [rules, setRules] = useState<RuleInfo[]>([]);

  useEffect(() => {
    getRules().then(setRules).catch(() => {});
  }, []);

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{t('advanced.ruleProvider')}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {rules.map((r) => (
          <option key={r.id} value={r.id} title={r.description}>{r.name}</option>
        ))}
      </select>
    </div>
  );
}
