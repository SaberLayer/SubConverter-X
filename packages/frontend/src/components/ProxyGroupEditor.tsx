import { useTranslation } from 'react-i18next';
import { ProxyGroup } from '../api';

interface Props {
  groups: ProxyGroup[];
  disabled?: boolean;
  onChange: (groups: ProxyGroup[]) => void;
}

const GROUP_TYPES: ProxyGroup['type'][] = ['select', 'url-test', 'fallback', 'load-balance'];

function normalizeGroups(groups: ProxyGroup[]): ProxyGroup[] {
  return groups.map((g) => {
    const next: ProxyGroup = {
      name: g.name,
      type: g.type,
    };
    if (g.filter && g.filter.trim()) next.filter = g.filter.trim();
    if (g.proxies && g.proxies.length > 0) next.proxies = g.proxies;
    if (g.url && g.url.trim()) next.url = g.url.trim();
    if (typeof g.interval === 'number' && Number.isFinite(g.interval) && g.interval > 0) {
      next.interval = g.interval;
    }
    return next;
  });
}

export default function ProxyGroupEditor({ groups, disabled, onChange }: Props) {
  const { t } = useTranslation();

  const updateGroup = (index: number, patch: Partial<ProxyGroup>) => {
    const next = groups.map((g, i) => (i === index ? { ...g, ...patch } : g));
    onChange(normalizeGroups(next));
  };

  const removeGroup = (index: number) => {
    const next = groups.filter((_, i) => i !== index);
    onChange(next);
  };

  const addGroup = () => {
    const next: ProxyGroup[] = [
      ...groups,
      {
        name: `Group ${groups.length + 1}`,
        type: 'select',
        proxies: ['DIRECT'],
      },
    ];
    onChange(next);
  };

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">{t('advanced.customProxyGroups')}</h3>
        <button
          type="button"
          onClick={addGroup}
          disabled={disabled}
          className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
        >
          {t('common.add')}
        </button>
      </div>

      {groups.length === 0 ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">{t('advanced.noProxyGroups')}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group, idx) => (
            <div key={`${idx}-${group.name}`} className="p-3 border border-gray-200 dark:border-gray-700 rounded-md space-y-2">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.groupName')}</label>
                  <input
                    type="text"
                    value={group.name}
                    onChange={(e) => updateGroup(idx, { name: e.target.value })}
                    disabled={disabled}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.groupType')}</label>
                  <select
                    value={group.type}
                    onChange={(e) => updateGroup(idx, { type: e.target.value as ProxyGroup['type'] })}
                    disabled={disabled}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {GROUP_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.groupInterval')}</label>
                  <input
                    type="number"
                    min={1}
                    value={group.interval ?? ''}
                    onChange={(e) => {
                      const value = e.target.value.trim();
                      updateGroup(idx, { interval: value ? Number(value) : undefined });
                    }}
                    disabled={disabled}
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.groupFilter')}</label>
                <input
                  type="text"
                  value={group.filter ?? ''}
                  onChange={(e) => updateGroup(idx, { filter: e.target.value || undefined })}
                  disabled={disabled}
                  placeholder={t('advanced.groupFilterPlaceholder')}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.groupProxies')}</label>
                <input
                  type="text"
                  value={(group.proxies || []).join(',')}
                  onChange={(e) => {
                    const proxies = e.target.value.split(',').map((x) => x.trim()).filter(Boolean);
                    updateGroup(idx, { proxies: proxies.length ? proxies : undefined });
                  }}
                  disabled={disabled}
                  placeholder={t('advanced.groupProxiesPlaceholder')}
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{t('advanced.groupUrl')}</label>
                  <input
                    type="text"
                    value={group.url ?? ''}
                    onChange={(e) => updateGroup(idx, { url: e.target.value || undefined })}
                    disabled={disabled}
                    placeholder="http://www.gstatic.com/generate_204"
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => removeGroup(idx)}
                    disabled={disabled}
                    className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-md transition-colors"
                  >
                    {t('common.delete')}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
