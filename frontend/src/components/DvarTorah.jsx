import { useState } from 'react';
import { useLang } from '../i18n';

export default function DvarTorah({ data }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);

  if (!data.dvar_torah) return null;

  return (
    <div className="dvar-torah-container">
      <button className="dt-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span>📖 {t('halachaBtn')}</span>
        <span className={open ? 'dt-arrow open' : 'dt-arrow'}>▼</span>
      </button>
      {open && (
        <div className="dt-content" dir="rtl" lang="he">
          <div>{data.dvar_torah}</div>
          {data.dvar_source && <div className="dt-source">{data.dvar_source}</div>}
        </div>
      )}
    </div>
  );
}
