import type { FormEvent } from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { changePassword } from '../api';
import { Button } from '../components/Button';
import { Input } from '../components/Input';
import { useAuth } from '../contexts/AuthContext';
import { resolveErrorMessage } from '../utils/errors';

export function ChangePasswordPage() {
    const { user, checkAuth, logout } = useAuth();
    const navigate = useNavigate();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        setError(null);

        if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
            setError('All fields are required.');
            return;
        }

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match.');
            return;
        }

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters long.');
            return;
        }

        setLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            await checkAuth();
            void navigate('/');
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to update password.'));
        } finally {
            setLoading(false);
        }
    };

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
                            Update Your Password
                        </h1>
                        <p className='mt-2 text-sm text-slate-400'>
                            {user
                                ? `Welcome, ${user.full_name}. For security, please create a new password before continuing.`
                                : 'Create a new password before continuing.'}
                        </p>
                    </div>
                    <form onSubmit={(event) => { void handleSubmit(event); }} className='space-y-4'>
                        <Input
                            label='Current Password'
                            type='password'
                            value={currentPassword}
                            onChange={(event) => { setCurrentPassword(event.target.value); }}
                            disabled={loading}
                            autoComplete='current-password'
                            autoFocus
                        />
                        <Input
                            label='New Password'
                            type='password'
                            value={newPassword}
                            onChange={(event) => { setNewPassword(event.target.value); }}
                            disabled={loading}
                            autoComplete='new-password'
                        />
                        <p className='text-xs text-slate-500'>Minimum 8 characters.</p>
                        <Input
                            label='Confirm New Password'
                            type='password'
                            value={confirmPassword}
                            onChange={(event) => { setConfirmPassword(event.target.value); }}
                            disabled={loading}
                            autoComplete='new-password'
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
                            Save Password
                        </Button>
                    </form>

                    <div className='mt-6 text-center text-xs text-slate-500'>
                        Need to exit?
                        {' '}
                        <button
                            type='button'
                            onClick={logout}
                            className='text-sky-400 hover:text-sky-300'
                        >
                            Log out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}