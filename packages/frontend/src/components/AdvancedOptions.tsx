import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface Props {
  include: string;
  exclude: string;
  rename: string;
  addEmoji: boolean;
  deduplicate: boolean;
  sort: 'none' | 'name' | 'region';
  enableUdp?: boolean;
  skipCertVerify?: boolean;
  autoRegionGroup: boolean;
  onIncludeChange: (v: string) => void;
  onExcludeChange: (v: string) => void;
  onRenameChange: (v: string) => void;
  onAddEmojiChange: (v: boolean) => void;
  onDeduplicateChange: (v: boolean) => void;
  onSortChange: (v: 'none' | 'name' | 'region') => void;
  onEnableUdpChange: (v: boolean | undefined) => void;
  onSkipCertVerifyChange: (v: boolean | undefined) => void;
  onAutoRegionGroupChange: (v: boolean) => void;
}

export default function AdvancedOptions({
  include, exclude, rename, addEmoji, deduplicate, sort,
  enableUdp, skipCertVerify, autoRegionGroup,
  onIncludeChange, onExcludeChange, onRenameChange,
  onAddEmojiChange, onDeduplicateChange, onSortChange,
  onEnableUdpChange, onSkipCertVerifyChange, onAutoRegionGroupChange
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        <span>{t('advanced.title')}</span>
        <svg className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4">
          {/* Filter Section */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('advanced.nodeFilter')}</h3>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('advanced.includeNodes')}
              </label>
              <input
                type="text"
                value={include}
                onChange={(e) => onIncludeChange(e.target.value)}
                placeholder={t('advanced.nodeFilterPlaceholder')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('advanced.excludeNodes')}
              </label>
              <input
                type="text"
                value={exclude}
                onChange={(e) => onExcludeChange(e.target.value)}
                placeholder={t('advanced.nodeFilterPlaceholder')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                {t('advanced.renameNodes')}
              </label>
              <input
                type="text"
                value={rename}
                onChange={(e) => onRenameChange(e.target.value)}
                placeholder={t('advanced.renamePattern')}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Node Processing Section */}
          <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('advanced.title')}</h3>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={addEmoji}
                onChange={(e) => onAddEmojiChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('advanced.emoji')}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={deduplicate}
                onChange={(e) => onDeduplicateChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('advanced.deduplicate')}</span>
            </label>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.sort')}</label>
              <select
                value={sort}
                onChange={(e) => onSortChange(e.target.value as any)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="none">{t('common.cancel')}</option>
                <option value="name">{t('advanced.sort')}</option>
                <option value="region">{t('advanced.sort')}</option>
              </select>
            </div>
          </div>

          {/* Global Settings Section */}
          <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('advanced.title')}</h3>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.udp')}</label>
              <select
                value={enableUdp === undefined ? 'default' : enableUdp ? 'true' : 'false'}
                onChange={(e) => {
                  const val = e.target.value;
                  onEnableUdpChange(val === 'default' ? undefined : val === 'true');
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">{t('common.cancel')}</option>
                <option value="true">{t('common.confirm')}</option>
                <option value="false">{t('common.cancel')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.scv')}</label>
              <select
                value={skipCertVerify === undefined ? 'default' : skipCertVerify ? 'true' : 'false'}
                onChange={(e) => {
                  const val = e.target.value;
                  onSkipCertVerifyChange(val === 'default' ? undefined : val === 'true');
                }}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">{t('common.cancel')}</option>
                <option value="true">{t('common.confirm')}</option>
                <option value="false">{t('common.cancel')}</option>
              </select>
            </div>
          </div>

          {/* Proxy Groups Section */}
          <div className="space-y-3 pt-3 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">{t('advanced.proxyGroups')}</h3>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRegionGroup}
                onChange={(e) => onAutoRegionGroupChange(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">{t('advanced.proxyGroups')}</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}
