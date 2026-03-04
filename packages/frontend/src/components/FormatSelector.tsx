import { useTranslation } from 'react-i18next';

const formats = [
  { id: 'auto', label: 'Auto (UA Detect)' },
  { id: 'clash', label: 'Clash' },
  { id: 'clashr', label: 'ClashR' },
  { id: 'clash-meta', label: 'Clash Meta / mihomo' },
  { id: 'stash', label: 'Stash' },
  { id: 'singbox', label: 'sing-box' },
  { id: 'surge', label: 'Surge 5' },
  { id: 'surgemac', label: 'Surge Mac' },
  { id: 'egern', label: 'Egern' },
  { id: 'surfboard', label: 'Surfboard' },
  { id: 'quantumultx', label: 'Quantumult X' },
  { id: 'shadowrocket', label: 'Shadowrocket' },
  { id: 'loon', label: 'Loon' },
  { id: 'v2ray', label: 'V2Ray / Xray' },
  { id: 'v2ray-uri', label: 'V2Ray URI' },
  { id: 'mixed', label: 'Mixed URI' },
  { id: 'plain-json', label: 'Plain JSON' },
  { id: 'base64', label: 'Base64 URI' },
];

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function FormatSelector({ value, onChange }: Props) {
  const { t } = useTranslation();

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{t('output.title')}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {formats.map((f) => (
          <option key={f.id} value={f.id}>{f.label}</option>
        ))}
      </select>
    </div>
  );
}
