/* eslint-disable react-refresh/only-export-components */
// Provider + hook co-located (same convention as i18n.jsx).
// The site shows a single community's times — the location is pinned to the
// default and there is no picker UI. (A previously saved localStorage choice
// from the old picker is intentionally ignored so everyone sees our times.)
import { createContext, useContext } from 'react';
import { getLocation, DEFAULT_LOCATION } from './lib/communities';

const LocationContext = createContext(null);

export function LocationProvider({ children }) {
  const location = getLocation(DEFAULT_LOCATION);
  return (
    <LocationContext.Provider value={{ locationId: DEFAULT_LOCATION, location }}>
      {children}
    </LocationContext.Provider>
  );
}

export function useLocation() {
  return useContext(LocationContext);
}
