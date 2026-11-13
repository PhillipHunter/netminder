import type { ReactNode } from 'react';
import {
    createContext,
    useContext,
    useEffect,
    useState
} from 'react';

import type {
    AuthResponse,
    User
} from '../api';
import {
    fetchCurrentUser,
    loginUser,
    logoutUser
} from '../api';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (username: string, password: string) => Promise<AuthResponse>;
    logout: () => void;
    checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    const checkAuth = async () => {
        try {
            setLoading(true);
            const currentUser = await fetchCurrentUser();
            setUser(currentUser);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message !== 'Authentication required') {
                console.error('Failed to check auth:', error);
            }
            setUser(null);
        } finally {
            setLoading(false);
        }
    };

    const login = async (username: string, password: string): Promise<AuthResponse> => {
        try {
            const result = await loginUser(username.trim(), password);
            setUser(result.user);
            return result;
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    };

    const logout = () => {
        void (async () => {
            try {
                await logoutUser();
            } catch (error) {
                console.error('Logout failed:', error);
            } finally {
                setUser(null);
                window.location.href = '/login';
            }
        })();
    };

    useEffect(() => {
        void checkAuth();
    }, []);

    const value: AuthContextType = {
        user,
        loading,
        login,
        logout,
        checkAuth
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}