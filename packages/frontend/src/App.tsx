import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import InputArea from './components/InputArea';
import FormatSelector from './components/FormatSelector';
import RuleSelector from './components/RuleSelector';
import AdvancedOptions from './components/AdvancedOptions';
import PresetManager from './components/PresetManager';
import Preview from './components/Preview';
import ThemeToggle from './components/ThemeToggle';
import LanguageSwitcher from './components/LanguageSwitcher';
import { convert, shorten, ConvertResponse, ShortenResponse, ProxyGroup } from './api';
import './i18n';

export default function App() {
  const { t } = useTranslation();
  const [input, setInput] = useState('');
  const [target, setTarget] = useState('clash-meta');
  const [ruleTemplate, setRuleTemplate] = useState('bypass-cn');
  const [include, setInclude] = useState('');
  const [exclude, setExclude] = useState('');
  const [rename, setRename] = useState('');
  const [addEmoji, setAddEmoji] = useState(true);
  const [deduplicate, setDeduplicate] = useState(true);
  const [sort, setSort] = useState<'none' | 'name' | 'region'>('none');
  const [enableUdp, setEnableUdp] = useState<boolean | undefined>(undefined);
  const [skipCertVerify, setSkipCertVerify] = useState<boolean | undefined>(undefined);
  const [autoRegionGroup, setAutoRegionGroup] = useState(false);
  const [proxyGroups, setProxyGroups] = useState<ProxyGroup[]>([]);
  const [result, setResult] = useState<ConvertResponse | null>(null);
  const [shortUrl, setShortUrl] = useState<ShortenResponse | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentConfig = {
    target, ruleTemplate, include, exclude, rename,
    addEmoji, deduplicate, sort, autoRegionGroup,
    ...(enableUdp !== undefined && { enableUdp }),
    ...(skipCertVerify !== undefined && { skipCertVerify }),
  };

  const loadPreset = (config: any) => {
    setTarget(config.target);
    setRuleTemplate(config.ruleTemplate);
    setInclude(config.include);
    setExclude(config.exclude);
    setRename(config.rename);
    setAddEmoji(config.addEmoji);
    setDeduplicate(config.deduplicate);
    setSort(config.sort);
    setEnableUdp(config.enableUdp);
    setSkipCertVerify(config.skipCertVerify);
    setAutoRegionGroup(config.autoRegionGroup);
  };

  const buildRequest = () => {
    const req: any = { input, target, ruleTemplate };
    if (include.trim()) req.include = include.trim();
    if (exclude.trim()) req.exclude = exclude.trim();
    if (rename.trim()) req.rename = rename.trim();
    req.addEmoji = addEmoji;
    req.deduplicate = deduplicate;
    req.sort = sort;
    if (enableUdp !== undefined) req.enableUdp = enableUdp;
    if (skipCertVerify !== undefined) req.skipCertVerify = skipCertVerify;
    req.autoRegionGroup = autoRegionGroup;
    if (proxyGroups.length > 0 && !autoRegionGroup) req.proxyGroups = proxyGroups;
    return req;
  };

  const handleConvert = async () => {
    setError('');
    setResult(null);
    setShortUrl(null);
    setLoading(true);
    try {
      const res = await convert(buildRequest());
      setResult(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShorten = async () => {
    setError('');
    setShortUrl(null);
    setLoading(true);
    try {
      const res = await shorten(buildRequest());
      setShortUrl(res);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <LanguageSwitcher />
      <header className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('common.appName')}</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{t('header.subtitle')}</p>
          </div>
          <ThemeToggle />
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <InputArea value={input} onChange={setInput} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormatSelector value={target} onChange={setTarget} />
          <RuleSelector value={ruleTemplate} onChange={setRuleTemplate} />
        </div>

        <AdvancedOptions
          include={include} exclude={exclude} rename={rename}
          addEmoji={addEmoji} deduplicate={deduplicate} sort={sort}
          enableUdp={enableUdp} skipCertVerify={skipCertVerify}
          autoRegionGroup={autoRegionGroup}
          onIncludeChange={setInclude} onExcludeChange={setExclude} onRenameChange={setRename}
          onAddEmojiChange={setAddEmoji} onDeduplicateChange={setDeduplicate}
          onSortChange={setSort} onEnableUdpChange={setEnableUdp}
          onSkipCertVerifyChange={setSkipCertVerify}
          onAutoRegionGroupChange={setAutoRegionGroup}
        />

        <PresetManager currentConfig={currentConfig} onLoadPreset={loadPreset} />

        <div className="flex gap-3">
          <button
            onClick={handleConvert}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {loading ? t('common.converting') : t('common.convert')}
          </button>
          <button
            onClick={handleShorten}
            disabled={loading || !input.trim()}
            className="px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
          >
            {t('result.generateShortUrl')}
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        {shortUrl && (
          <div className="p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-sm">
            <span className="text-green-700 dark:text-green-300">{t('result.subscriptionUrl')}: </span>
            <a href={shortUrl.url} className="text-blue-600 dark:text-blue-400 underline break-all" target="_blank" rel="noreferrer">
              {shortUrl.url}
            </a>
          </div>
        )}

        {result && <Preview output={result.output} nodeCount={result.nodeCount} skipped={result.skipped} filteredOut={result.filteredOut} target={target} />}
      </main>
    </div>
  );
}
