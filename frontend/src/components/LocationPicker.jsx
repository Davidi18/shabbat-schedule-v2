import { useLang } from '../i18n';
import { useLocation } from '../location';
import { LOCATION_GROUPS, locationLabel, getLocation } from '../lib/communities';

// Location selector — grouped by community / Israel / diaspora. Native <select>
// for zero-dependency accessibility, keyboard support and mobile ergonomics.
export default function LocationPicker() {
  const { t, lang } = useLang();
  const { locationId, setLocationId, location } = useLocation();

  return (
    <label className="loc-picker" title={t('locationLabel')}>
      <span className="loc-pin" aria-hidden="true">📍</span>
      <span className="loc-current">{locationLabel(location, lang)}</span>
      <select
        className="loc-select"
        value={locationId}
        onChange={(e) => setLocationId(e.target.value)}
        aria-label={t('locationLabel')}
      >
        {LOCATION_GROUPS.map((group) => (
          <optgroup key={group.key} label={t(`group_${group.key}`)}>
            {group.ids.map((id) => (
              <option key={id} value={id}>
                {locationLabel(getLocation(id), lang)}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <span className="loc-caret" aria-hidden="true">▾</span>
    </label>
  );
}
