import type { FormEvent } from 'react';
import {
    useCallback,
    useEffect,
    useState
} from 'react';
import {
    FiSave,
    FiShield,
    FiTrash2
} from 'react-icons/fi';

import type { QrzSettingsStatus } from '../api';
import {
    deleteQrzSettings,
    fetchQrzSettings,
    updateAppSettings,
    updateQrzSettings
} from '../api';
import { PageHeader } from '../components/PageHeader';
import { useAppConfig } from '../contexts/AppConfigContext';
import { resolveErrorMessage } from '../utils/errors';

export function SettingsPage() {
    const { mobilityEnabled, refresh: refreshAppConfig } = useAppConfig();
    const [status, setStatus] = useState<QrzSettingsStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [savingMobility, setSavingMobility] = useState(false);
    const [mobilityError, setMobilityError] = useState<string | null>(null);

    const fetchStatus = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetchQrzSettings();
            setStatus(response);
            setUsername(response.username ?? '');
        } catch (err) {
            console.error('Failed to load QRZ settings:', err);
            setError(resolveErrorMessage(err, 'Failed to load QRZ settings.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchStatus();
    }, [fetchStatus]);

    const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();

        if (!username.trim()) {
            setError('QRZ username is required.');
            return;
        }

        if (!password.trim()) {
            setError('QRZ password is required.');
            return;
        }

        const start = Date.now();
        const minValidationMs = 1000;
        let waited = false;
        const waitMinimum = async () => {
            if (waited)
                return;
            waited = true;
            const elapsed = Date.now() - start;
            if (elapsed < minValidationMs) {
                await new Promise(resolve => setTimeout(resolve, minValidationMs - elapsed));
            }
        };

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            const responsePromise = updateQrzSettings({
                username,
                password
            });

            const response = await responsePromise;

            await waitMinimum();

            setStatus(response);
            setSuccessMessage('QRZ credentials updated successfully.');
            setPassword('');
        } catch (err) {
            console.error('Failed to update QRZ settings:', err);
            await waitMinimum();
            setError(resolveErrorMessage(err, 'Failed to update QRZ settings.'));
        } finally {
            await waitMinimum();
            setSaving(false);
        }
    };

    const handleFormSubmit = (event: FormEvent<HTMLFormElement>) => {
        void handleSubmit(event);
    };

    const handleRemove = async () => {
        if (!status?.configured || !status.username) {
            return;
        }

        const confirmed = window.confirm(
            'Remove QRZ credentials? NetMinder will disable QRZ lookups until new credentials are saved.'
        );
        if (!confirmed) {
            return;
        }

        try {
            setRemoving(true);
            setError(null);
            setSuccessMessage(null);
            await deleteQrzSettings();
            await fetchStatus();
            setPassword('');
            setSuccessMessage('QRZ credentials removed.');
        } catch (err) {
            console.error('Failed to remove QRZ settings:', err);
            setError(resolveErrorMessage(err, 'Failed to remove QRZ credentials.'));
        } finally {
            setRemoving(false);
        }
    };

    const handleMobilityToggle = async (enabled: boolean) => {
        try {
            setSavingMobility(true);
            setMobilityError(null);
            await updateAppSettings({ mobility_enabled: enabled });
            await refreshAppConfig();
        } catch (err) {
            console.error('Failed to update app settings:', err);
            setMobilityError(resolveErrorMessage(err, 'Failed to update mobility tracking.'));
        } finally {
            setSavingMobility(false);
        }
    };

    const isConfigured = status?.configured ?? false;

    return (
        <div className='min-h-screen bg-slate-950'>
            <PageHeader />

            <main className='mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8'>
                <header className='mb-10 space-y-3'>
                    <span className='inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-400'>
                        <FiShield className='h-4 w-4' />
                        Admin
                    </span>
                    <h1 className='text-3xl font-semibold text-slate-50 sm:text-4xl'>Settings</h1>
                </header>

                <h2 className='text-xl font-semibold text-slate-100'>QRZ Integration</h2>
                <p className='mb-4 mt-2 max-w-2xl text-sm text-slate-400'>
                    Manage the credentials NetMinder uses to authenticate against the QRZ XML API. Passwords are
                    encrypted at rest and never displayed once saved.
                </p>

                <section className='rounded-3xl border border-slate-800/70 bg-slate-900/80 p-8 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.9)]'>
                    {loading ? (
                        <div className='flex h-40 items-center justify-center text-sm text-slate-400'>
                            Loading QRZ configuration…
                        </div>
                    ) : (
                        <div className='space-y-6'>
                            {error && (
                                <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                                    {error}
                                </div>
                            )}

                            {successMessage && (
                                <div className='rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>
                                    {successMessage}
                                </div>
                            )}

                            {isConfigured ? (
                                <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                                    <div>
                                        <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-400'>
                                            Active Username
                                        </p>
                                        <div className='mt-2 text-lg font-medium text-slate-100'>
                                            {status?.username}
                                        </div>
                                        <p className='mt-1 text-sm text-slate-500'>
                                            Remove credentials to disable QRZ lookups or to connect a different account.
                                        </p>
                                    </div>
                                    <button
                                        type='button'
                                        onClick={() => { void handleRemove(); }}
                                        className='inline-flex items-center gap-2 rounded-2xl border border-red-500/50 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:text-red-100 focus:outline-none focus:ring-4 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-60'
                                        disabled={removing}
                                    >
                                        <FiTrash2 className='h-4 w-4' />
                                        {removing ? 'Removing…' : 'Remove Credentials'}
                                    </button>
                                </div>
                            ) : (
                                <form
                                    onSubmit={handleFormSubmit}
                                    className='space-y-6'
                                >
                                    <div className='grid gap-6 md:grid-cols-2'>
                                        <div className='space-y-2'>
                                            <label className='text-sm font-medium text-slate-300'>
                                                QRZ Username
                                            </label>
                                            <input
                                                type='text'
                                                value={username}
                                                onChange={(event) => { setUsername(event.target.value); }}
                                                className='w-full rounded-2xl border border-slate-700/70 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20'
                                                placeholder='e.g. netminder_lookup'
                                                autoComplete='off'
                                            />
                                        </div>
                                        <div className='space-y-2'>
                                            <label className='flex items-center justify-between text-sm font-medium text-slate-300'>
                                                <span>QRZ Password</span>
                                                <span className='text-xs text-slate-500'>Stored encrypted</span>
                                            </label>
                                            <input
                                                type='password'
                                                value={password}
                                                onChange={(event) => { setPassword(event.target.value); }}
                                                className='w-full rounded-2xl border border-slate-700/70 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20'
                                                placeholder='Enter password'
                                                autoComplete='off'
                                            />
                                        </div>
                                    </div>

                                    <div className='flex justify-end'>
                                        <button
                                            type='submit'
                                            className='inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_30px_-22px_rgba(79,70,229,0.8)] transition hover:from-indigo-400 hover:to-violet-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60'
                                            disabled={saving}
                                        >
                                            <FiSave className='h-4 w-4' />
                                            {saving ? 'Validating…' : 'Save Credentials'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    )}
                </section>

                <h2 className='mt-10 text-xl font-semibold text-slate-100'>Check-in Options</h2>
                <section className='mt-4 space-y-4 rounded-3xl border border-slate-800/70 bg-slate-900/80 p-8 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.9)]'>
                    {mobilityError && (
                        <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                            {mobilityError}
                        </div>
                    )}
                    <label className='flex cursor-pointer items-start gap-3'>
                        <input
                            type='checkbox'
                            checked={mobilityEnabled}
                            onChange={(event) => { void handleMobilityToggle(event.target.checked); }}
                            disabled={savingMobility}
                            className='mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-60'
                        />
                        <span>
                            <span className='block text-sm font-medium text-slate-200'>
                                Enable mobility tracking
                                {savingMobility && <span className='ml-2 text-xs text-slate-500'>Saving…</span>}
                            </span>
                            <span className='mt-1 block text-sm text-slate-400'>
                                When disabled, mobility options are hidden and new check-ins are saved as fixed. Existing
                                mobility data is kept and returns if tracking is re-enabled.
                            </span>
                        </span>
                    </label>
                </section>
            </main>
        </div>
    );
}