/* eslint-disable react-refresh/only-export-components */
// Provider + hook co-located (same convention as i18n.jsx).
import { createContext, useContext, useEffect, useState } from 'react';
import { getLocation, DEFAULT_LOCATION, LOCATIONS } from './lib/communities';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const [locationId, setLocationId] = useState(() => {
    try {
      const saved = localStorage.getItem('locationId');
      return saved && LOCATIONS[saved] ? saved : DEFAULT_LOCATION;
    } catch {
      return DEFAULT_LOCATION;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('locationId', locationId);
    } catch {
      // localStorage unavailable — selection just won't persist
    }
  }, [locationId]);

  const location = getLocation(locationId);
  return (
    <LocationContext.Provider value={{ locationId, setLocationId, location }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
