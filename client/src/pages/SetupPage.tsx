import type { FormEvent } from 'react';
import {
    useEffect,
    useState
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
    fetchSetupStatus,
    registerInitialUser
} from '../api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { resolveErrorMessage } from '../utils/errors';

export function SetupPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingSetup, setCheckingSetup] = useState(true);
    const { user, login } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        // If already logged in, redirect to dashboard
        if (user) {
            void navigate('/');
            return;
        }

        // Verify that setup is actually needed
        const verifySetupNeeded = async () => {
            try {
                const status = await fetchSetupStatus();
                if (!status.needsSetup) {
                    // Setup already complete, redirect to login
                    void navigate('/login');
                }
            } catch (err) {
                // If endpoint doesn't exist, redirect to login
                console.error('Setup check failed:', err);
                void navigate('/login');
            } finally {
                setCheckingSetup(false);
            }
        };

        void verifySetupNeeded();
    }, [user, navigate]);

    const validateForm = (): boolean => {
        if (!username.trim()) {
            setError('Username is required');
            return false;
        }

        if (username.length < 3) {
            setError('Username must be at least 3 characters');
            return false;
        }

        if (!password) {
            setError('Password is required');
            return false;
        }

        if (password.length < 8) {
            setError('Password must be at least 8 characters');
            return false;
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return false;
        }

        return true;
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        setLoading(true);

        try {
            // Create the initial admin account
            await registerInitialUser({
                username: username.trim(),
                password
            });

            // Now log in with the credentials
            await login(username.trim(), password);

            // Redirect to dashboard
            void navigate('/');
        } catch (err) {
            setError(resolveErrorMessage(err, 'Setup failed. Please try again.'));
        } finally {
            setLoading(false);
        }
    };

    if (checkingSetup) {
        return (
            <div className='flex min-h-screen items-center justify-center bg-slate-950 px-4'>
                <div className='text-slate-400'>Loading...</div>
            </div>
        );
    }

    return (
        <div className='flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8'>
            <div
                className='pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.15),_rgba(15,23,42,0))]'
                aria-hidden='true'
            />

            <div className='relative w-full max-w-md'>
                <div className='rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 shadow-[0_20px_60px_-15px_rgba(15,23,42,1)] backdrop-blur-xl'>
                    <div className='mb-6 text-center'>
                        <div className='mb-3 inline-flex items-center gap-2 rounded-full border border-sky-500/50 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-400'>
                            <span className='h-1.5 w-1.5 rounded-full bg-sky-400' />
                            First-Time Setup
                        </div>
                        <h1 className='text-3xl font-semibold tracking-tight text-slate-100'>
                            Welcome to
                            {' '}
                            <span className='text-sky-400'>NetMinder</span>
                        </h1>
                        <p className='mt-2 text-sm text-slate-400'>
                            Create your admin account to get started
                        </p>
                    </div>

                    <div className='mb-6 rounded-lg border border-slate-700/70 bg-slate-800/50 p-4'>
                        <p className='text-sm text-slate-300'>
                            This will be the administrator account with full access to manage users and system settings.
                        </p>
                    </div>

                    <form onSubmit={(e) => { void handleSubmit(e); }} className='space-y-4'>
                        <Input
                            label='Username'
                            type='text'
                            value={username}
                            onChange={(e) => { setUsername(e.target.value); }}
                            placeholder='Choose a username'
                            autoComplete='username'
                            autoFocus
                            disabled={loading}
                        />

                        <Input
                            label='Password'
                            type='password'
                            value={password}
                            onChange={(e) => { setPassword(e.target.value); }}
                            placeholder='Create a strong password'
                            autoComplete='new-password'
                            disabled={loading}
                        />

                        <Input
                            label='Confirm Password'
                            type='password'
                            value={confirmPassword}
                            onChange={(e) => { setConfirmPassword(e.target.value); }}
                            placeholder='Re-enter your password'
                            autoComplete='new-password'
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
                            Create Admin Account
                        </Button>
                    </form>

                    <div className='mt-6 space-y-2 text-center text-xs text-slate-500'>
                        <p>
                            Press
                            {' '}
                            <kbd className='rounded bg-slate-800 px-1.5 py-0.5 font-mono'>Enter</kbd>
                            {' '}
                            to submit
                        </p>
                        <p className='text-slate-600'>
                            Password must be at least 8 characters
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}