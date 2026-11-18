import type { ReactNode } from 'react';
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState
} from 'react';

import { fetchAppConfig } from '../api';

import { useAuth } from './AuthContext';

interface AppConfigContextType {
    mobilityEnabled: boolean;
    geocodingEnabled: boolean;
    cartoApiKey: string | null;
    refresh: () => Promise<void>;
}

const AppConfigContext = createContext<AppConfigContextType | undefined>(undefined);

export function useAppConfig() {
    const context = useContext(AppConfigContext);
    if (context === undefined) {
        throw new Error('useAppConfig must be used within an AppConfigProvider');
    }
    return context;
}

interface AppConfigProviderProps {
    children: ReactNode;
}

export function AppConfigProvider({ children }: AppConfigProviderProps) {
    const { user } = useAuth();
    const userId = user?.id ?? null;
    const [mobilityEnabled, setMobilityEnabled] = useState(true);
    const [geocodingEnabled, setGeocodingEnabled] = useState(false);
    const [cartoApiKey, setCartoApiKey] = useState<string | null>(null);

    const refresh = useCallback(async () => {
        try {
            const config = await fetchAppConfig();
            setMobilityEnabled(config.mobility_enabled);
            setGeocodingEnabled(config.geocoding_enabled);
            setCartoApiKey(config.carto_api_key);
        } catch (error) {
            console.error('Failed to load app config:', error);
            setMobilityEnabled(true);
            setGeocodingEnabled(false);
            setCartoApiKey(null);
        }
    }, []);

    useEffect(() => {
        if (userId === null) {
            setMobilityEnabled(true);
            setGeocodingEnabled(false);
            setCartoApiKey(null);
            return;
        }

        void refresh();
    }, [userId, refresh]);

    const value = useMemo<AppConfigContextType>(() => ({
        mobilityEnabled,
        geocodingEnabled,
        cartoApiKey,
        refresh
    }), [mobilityEnabled, geocodingEnabled, cartoApiKey, refresh]);

    return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}