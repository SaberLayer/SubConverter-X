import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConversionWarning } from '../api';

interface Props {
  output: string;
  nodeCount: number;
  skipped: string[];
  warnings?: ConversionWarning[];
  filteredOut?: number;
  target: string;
}

export default function Preview({ output, nodeCount, skipped, warnings = [], filteredOut, target }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  void target;

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
              ({t('result.filteredOut', { count: filteredOut })})
            </span>
          ) : null}
          {skipped.length > 0 && (
            <span className="ml-2 text-yellow-600 dark:text-yellow-400">
              ({t('result.skippedUnsupported', { count: skipped.length })})
            </span>
          )}
          {warnings.length > 0 && (
            <span className="ml-2 text-amber-600 dark:text-amber-400">
              ({t('result.warnings', { count: warnings.length })})
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
      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-3 text-sm text-amber-900 dark:text-amber-100 space-y-2">
          <div className="font-medium">{t('result.compatibilityWarnings')}</div>
          <ul className="space-y-1">
            {warnings.map((warning, index) => (
              <li key={`${warning.code}-${index}`}>
                <span>{warning.message}</span>
                {warning.nodes?.length ? (
                  <span className="ml-1 text-xs text-amber-700 dark:text-amber-300">
                    {t('result.affectedNodes', { nodes: warning.nodes.join(', '), count: warning.count ?? warning.nodes.length })}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      <pre className="w-full max-h-96 overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-xs font-mono whitespace-pre-wrap break-all">
        {output}
      </pre>
    </div>
  );
}
