import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  output: string;
  nodeCount: number;
  skipped: string[];
  filteredOut?: number;
  target: string;
}

export default function Preview({ output, nodeCount, skipped, filteredOut, target }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-600 dark:text-gray-400">
          {t('result.nodeCount', { count: nodeCount })}
          {filteredOut ? (
            <span className="ml-2 text-blue-600 dark:text-blue-400">
              ({filteredOut} {t('advanced.nodeFilter')})
            </span>
          ) : null}
          {skipped.length > 0 && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400">
              ({skipped.length} {t('error.unsupportedProtocol', { protocol: '' })})
            </span>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded transition-colors"
        >
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
      <pre className="w-full max-h-96 overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-xs font-mono whitespace-pre-wrap break-all">
        {output}
      </pre>
    </div>
  );
}
