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
  const groupedWarnings = warnings.reduce<Record<string, ConversionWarning[]>>((acc, warning) => {
    const key = warning.code || 'UNKNOWN';
    acc[key] = acc[key] || [];
    acc[key].push(warning);
    return acc;
  }, {});
  const warningCount = warnings.filter((warning) => warning.severity === 'warning').length;
  const infoCount = warnings.filter((warning) => warning.severity === 'info').length;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
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
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{t('result.compatibilityReport')}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{t('result.targetFormat', { target })}</div>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-green-100 dark:bg-green-900/30 px-2 py-1 text-green-700 dark:text-green-300">
              {t('result.supportedNodes', { count: nodeCount })}
            </span>
            {filteredOut ? (
              <span className="rounded bg-blue-100 dark:bg-blue-900/30 px-2 py-1 text-blue-700 dark:text-blue-300">
                {t('result.filteredOut', { count: filteredOut })}
              </span>
            ) : null}
            {skipped.length ? (
              <span className="rounded bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 text-yellow-700 dark:text-yellow-300">
                {t('result.skippedUnsupported', { count: skipped.length })}
              </span>
            ) : null}
            {warnings.length ? (
              <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-2 py-1 text-amber-700 dark:text-amber-300">
                {t('result.warningSummary', { warnings: warningCount, info: infoCount })}
              </span>
            ) : null}
          </div>
        </div>

        {skipped.length > 0 && (
          <div className="rounded border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 p-2 text-sm text-yellow-900 dark:text-yellow-100">
            <div className="font-medium">{t('result.skippedNodes')}</div>
            <div className="mt-1 text-xs break-words">{skipped.join(', ')}</div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="space-y-2">
            {Object.entries(groupedWarnings).map(([code, items]) => (
              <div
                key={code}
                className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-2 text-sm text-amber-900 dark:text-amber-100"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{code}</span>
                  <span className="text-xs text-amber-700 dark:text-amber-300">{t('result.warningGroupCount', { count: items.length })}</span>
                </div>
                <ul className="mt-1 space-y-1">
                  {items.map((warning, index) => (
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
            ))}
          </div>
        )}
      </div>
      <pre className="w-full max-h-96 overflow-auto rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-4 py-3 text-xs font-mono whitespace-pre-wrap break-all">
        {output}
      </pre>
    </div>
  );
}
