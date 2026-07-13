import { useState } from 'react';
import { useLang } from '../i18n';
import { useLocation } from '../location';
import { LOCATION_GROUPS, locationLabel, getLocation, nearestLocation } from '../lib/communities';

// Location selector — grouped by community / Israel / diaspora, plus a one-tap
// "use my location" that snaps to the nearest city. Native <select> for zero-dep
// accessibility, keyboard support and mobile ergonomics.
export default function LocationPicker() {
  const { t, lang } = useLang();
  const { locationId, setLocationId, location } = useLocation();
  const [geo, setGeo] = useState('idle'); // idle | busy | denied

  const locate = () => {
    if (!navigator.geolocation || geo === 'busy') return;
    setGeo('busy');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocationId(nearestLocation(pos.coords.latitude, pos.coords.longitude));
        setGeo('idle');
      },
      () => setGeo('denied'),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  };

  return (
    <div className="loc-row">
      <label className="loc-picker" title={t('locationLabel')}>
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

      {'geolocation' in navigator && (
        <button
          type="button"
          className="loc-geo"
          onClick={locate}
          disabled={geo === 'busy'}
          title={geo === 'denied' ? t('geoDenied') : t('geoLocate')}
          aria-label={t('geoLocate')}
        >
          {geo === 'busy' ? '⏳' : '📍'}
        </button>
      )}
    </div>
  );
}
