import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function InputArea({ value, onChange }: Props) {
  const { t } = useTranslation();

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = () => onChange(reader.result as string);
        reader.readAsText(file);
      }
    },
    [onChange]
  );

  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{t('input.title')}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        placeholder={t('input.placeholder')}
        rows={8}
        className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />
    </div>
  );
}
