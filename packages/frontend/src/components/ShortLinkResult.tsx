import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useTranslation } from 'react-i18next';
import type { ShortenResponse } from '../api';

interface Props {
  value: ShortenResponse;
}

function formatDate(seconds?: number): string {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleString();
}

export default function ShortLinkResult({ value }: Props) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(value.url, {
      errorCorrectionLevel: 'M',
      margin: 2,
      width: 192,
      color: {
        dark: '#111827',
        light: '#ffffff',
      },
    }).then((dataUrl) => {
      if (!cancelled) setQrDataUrl(dataUrl);
    }).catch(() => {
      if (!cancelled) setQrDataUrl('');
    });

    return () => {
      cancelled = true;
    };
  }, [value.url]);

  const copyUrl = async () => {
    await navigator.clipboard.writeText(value.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/30 p-4">
      <div className="flex flex-col md:flex-row md:items-start gap-4">
        <div className="flex-1 min-w-0 space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-green-800 dark:text-green-200">
              {t('result.shortLinkReady')}
            </h3>
            <p className="mt-1 text-xs text-green-700 dark:text-green-300">
              {value.ttlDays
                ? t('result.shortLinkTtl', { days: value.ttlDays })
                : t('result.shortLinkTip')}
            </p>
          </div>

          <div className="rounded-lg bg-white/80 dark:bg-gray-900/70 border border-green-100 dark:border-green-900 p-3">
            <a
              href={value.url}
              className="text-sm text-blue-700 dark:text-blue-300 underline break-all"
              target="_blank"
              rel="noreferrer"
            >
              {value.url}
            </a>
            {value.expiresAt && (
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t('result.expiresAt')}: {formatDate(value.expiresAt)}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={copyUrl}
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-green-600 hover:bg-green-700 text-white transition-colors"
            >
              {copied ? t('common.copied') : t('result.copyUrl')}
            </button>
            <a
              href={value.url}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 text-xs font-medium rounded-md bg-white dark:bg-gray-800 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 hover:bg-green-100 dark:hover:bg-green-900 transition-colors"
            >
              {t('result.openSubscription')}
            </a>
          </div>
        </div>

        {qrDataUrl && (
          <div className="self-start rounded-xl border border-green-100 dark:border-green-900 bg-white p-3 shadow-sm">
            <img src={qrDataUrl} alt={t('result.qrCode')} className="h-40 w-40" />
          </div>
        )}
      </div>
    </section>
  );
}
