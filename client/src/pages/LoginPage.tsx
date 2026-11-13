import type { FormEvent } from 'react';
import {
    useEffect,
    useState
} from 'react';
import { useNavigate } from 'react-router-dom';

import { fetchSetupStatus } from '../api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { resolveErrorMessage } from '../utils/errors';

export function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingSetup, setCheckingSetup] = useState(true);
    const { login, user } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // If already logged in, redirect to dashboard
        if (user) {
            void navigate('/');
            return;
        }

        // Check if setup is needed
        const checkSetup = async () => {
            try {
                const status = await fetchSetupStatus();
                if (status.needsSetup) {
                    void navigate('/setup');
                }
            } catch (err) {
                // If endpoint doesn't exist or errors, assume setup is not needed
                console.error('Setup check failed:', err);
            } finally {
                setCheckingSetup(false);
            }
        };

        void checkSetup();
    }, [user, navigate]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!username.trim() || !password.trim()) {
            setError('Username and password are required');
            return;
        }

        setLoading(true);

        try {
            const result = await login(username.trim(), password);
            if (result.user.must_change_password) {
                void navigate('/change-password');
            } else {
                void navigate('/');
            }
        } catch (err) {
            setError(resolveErrorMessage(err, 'Login failed. Please check your credentials.'));
        } finally {
            setLoading(false);
        }
    };

    if (checkingSetup) {
        return (
            <div className='flex min-h-screen items-center justify-center px-4'>
                <div className='text-slate-400'>Loading...</div>
            </div>
        );
    }

    return (
        <div className='flex min-h-screen items-center justify-center px-4'>
            <div
                className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(99,102,241,0.12),_rgba(15,23,42,0)),_radial-gradient(circle_at_bottom_right,_rgba(139,92,246,0.08),_rgba(15,23,42,0))]'
                aria-hidden='true'
            />

            <div className='relative w-full max-w-md'>
                <div className='rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/80 to-slate-900/80 p-8 shadow-2xl shadow-black/30 backdrop-blur-xl'>
                    <div className='absolute -top-px left-1/2 h-px w-3/4 -translate-x-1/2 bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent' />
                    <div className='mb-6 text-center'>
                        <h1 className='text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-purple-200 bg-clip-text text-transparent'>
                            Welcome to netMinder
                        </h1>
                        <p className='mt-2 text-sm text-slate-400'>
                            Sign in to continue
                        </p>
                    </div>

                    <form onSubmit={(e) => { void handleSubmit(e); }} className='space-y-4'>
                        <Input
                            label='Username'
                            type='text'
                            value={username}
                            onChange={(e) => { setUsername(e.target.value); }}
                            placeholder='Enter your username'
                            autoComplete='username'
                            autoFocus
                            disabled={loading}
                        />

                        <Input
                            label='Password'
                            type='password'
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); }}
                            placeholder='Enter your password'
                            autoComplete='current-password'
                            disabled={loading}
                        />

                        {error && (
                            <div className='rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400'>
                                {error}
                            </div>
                        )}

                        <Button
                            type='submit'
                            variant='primary'
                            loading={loading}
                            disabled={loading}
                            className='w-full'
                        >
                            Sign In
                        </Button>
                    </form>

                    <div className='mt-6 text-center text-xs text-slate-500'>
                        Press
                        {' '}
                        <kbd className='rounded bg-slate-800 px-1.5 py-0.5 font-mono'>Enter</kbd>
                        {' '}
                        to sign in
                    </div>
                </div>
            </div>
        </div>
    );
}