import { useEffect, useState } from 'react';
import { useLang } from '../i18n';

const BANK = { bank: '52', branch: '185', account: '579985' };
const PAYBOX_URL = 'https://links.payboxapp.com/iQMAfniSKUb';

// Donations: a button in the action row that opens a small dialog with the
// PayBox link and the community's bank-transfer details.
export default function Donations() {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(t('donateCopyText', BANK.bank, BANK.branch, BANK.account));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable — details are visible anyway */ }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-action btn-donate">
        {t('donate')}
      </button>

      {open && (
        <div className="donate-overlay" onClick={() => setOpen(false)} role="dialog" aria-modal="true" aria-label={t('donateTitle')}>
          <div className="donate-card" onClick={(e) => e.stopPropagation()}>
            <button className="donate-close" onClick={() => setOpen(false)} aria-label={t('close')}>✕</button>
            <h3 className="donate-title">{t('donateTitle')}</h3>

            <a className="donate-paybox" href={PAYBOX_URL} target="_blank" rel="noopener noreferrer">
              💝 {t('donatePaybox')}
            </a>

            <div className="donate-divider">{t('donateBank')}</div>

            <div className="donate-rows">
              <div className="donate-row"><span>{t('bankLabel')}</span><b>{BANK.bank}</b></div>
              <div className="donate-row"><span>{t('branchLabel')}</span><b>{BANK.branch}</b></div>
              <div className="donate-row"><span>{t('accountLabel')}</span><b>{BANK.account}</b></div>
            </div>

            <button className="donate-copy" onClick={copy}>
              {copied ? t('donateCopied') : t('donateCopy')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
