import type { FormEvent } from 'react';
import {
    useCallback,
    useEffect,
    useState
} from 'react';
import {
    FiCheckCircle,
    FiSave,
    FiShield,
    FiTrash2
} from 'react-icons/fi';

import type {
    AccountQrzStatus,
    MapSettings,
    QrzCredentialMode,
    QrzSettingsStatus
} from '../api';
import {
    deleteAccountQrz,
    deleteQrzSettings,
    fetchAccountQrz,
    fetchMapSettings,
    fetchQrzSettings,
    testAccountQrz,
    updateAccountQrz,
    updateAppSettings,
    updateMapSettings,
    updateQrzMode,
    updateQrzSettings
} from '../api';
import { PageHeader } from '../components/PageHeader';
import { CARTO_DARK_URL } from '../components/mapShared';
import { useAppConfig } from '../contexts/AppConfigContext';
import { useAuth } from '../contexts/AuthContext';
import { resolveErrorMessage } from '../utils/errors';

const SECTION_CLASS = 'rounded-3xl border border-slate-800/70 bg-slate-900/80 p-8 shadow-[0_25px_60px_-35px_rgba(15,23,42,0.9)]';
const INPUT_CLASS = 'w-full rounded-2xl border border-slate-700/70 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-400/60 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/20';
const PRIMARY_BUTTON_CLASS = 'inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_18px_30px_-22px_rgba(79,70,229,0.8)] transition hover:from-indigo-400 hover:to-violet-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60';
const SECONDARY_BUTTON_CLASS = 'inline-flex items-center gap-2 rounded-2xl border border-slate-600/70 px-4 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-400 hover:text-slate-50 focus:outline-none focus:ring-4 focus:ring-slate-500/30 disabled:cursor-not-allowed disabled:opacity-60';
const DANGER_BUTTON_CLASS = 'inline-flex items-center gap-2 rounded-2xl border border-red-500/50 px-4 py-2.5 text-sm font-semibold text-red-200 transition hover:border-red-400 hover:text-red-100 focus:outline-none focus:ring-4 focus:ring-red-500/30 disabled:cursor-not-allowed disabled:opacity-60';

interface CredentialFormProps {
    username: string;
    password: string;
    saving: boolean;
    submitLabel: string;
    onUsernameChange: (value: string) => void;
    onPasswordChange: (value: string) => void;
    onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}

function CredentialForm({
    username,
    password,
    saving,
    submitLabel,
    onUsernameChange,
    onPasswordChange,
    onSubmit
}: CredentialFormProps) {
    return (
        <form
            onSubmit={onSubmit}
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
                        onChange={(event) => { onUsernameChange(event.target.value); }}
                        className={INPUT_CLASS}
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
                        onChange={(event) => { onPasswordChange(event.target.value); }}
                        className={INPUT_CLASS}
                        placeholder='Enter password'
                        autoComplete='off'
                    />
                </div>
            </div>

            <div className='flex justify-end'>
                <button
                    type='submit'
                    className={PRIMARY_BUTTON_CLASS}
                    disabled={saving}
                >
                    <FiSave className='h-4 w-4' />
                    {saving ? 'Validating…' : submitLabel}
                </button>
            </div>
        </form>
    );
}

interface Banners {
    error: string | null;
    success: string | null;
}

function SectionDivider({ label, note }: { label: string; note?: string }) {
    return (
        <div className='flex items-center gap-3'>
            <span className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-400'>
                {label}
                {note && <span className='ml-2 font-normal text-slate-500'>{note}</span>}
            </span>
            <div className='h-px flex-1 bg-slate-700/70' />
        </div>
    );
}

function StatusBanners({ error, success }: Banners) {
    return (
        <>
            {error && (
                <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                    {error}
                </div>
            )}

            {success && (
                <div className='rounded-2xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200'>
                    {success}
                </div>
            )}
        </>
    );
}

async function withMinimumDelay<T>(promise: Promise<T>, minMs = 1000): Promise<T> {
    const start = Date.now();
    const settle = async (): Promise<void> => {
        const elapsed = Date.now() - start;
        if (elapsed < minMs) {
            await new Promise(resolve => setTimeout(resolve, minMs - elapsed));
        }
    };

    try {
        const result = await promise;
        await settle();
        return result;
    } catch (err) {
        await settle();
        throw err;
    }
}

function MyQrzSection({ account, onChanged }: { account: AccountQrzStatus; onChanged: () => Promise<void> }) {
    const [username, setUsername] = useState(account.username ?? '');
    const [password, setPassword] = useState('');
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [removing, setRemoving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const isGlobal = account.mode === 'global';
    const showForm = !account.configured || editing;

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

        try {
            setSaving(true);
            setError(null);
            setSuccess(null);
            await withMinimumDelay(updateAccountQrz({
                username,
                password
            }));
            setPassword('');
            setEditing(false);
            await onChanged();
            setSuccess('Your QRZ credentials were saved.');
        } catch (err) {
            console.error('Failed to update QRZ credentials:', err);
            setError(resolveErrorMessage(err, 'Failed to update your QRZ credentials.'));
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        try {
            setTesting(true);
            setError(null);
            setSuccess(null);
            const result = await withMinimumDelay(testAccountQrz());
            if (result.valid) {
                setSuccess('QRZ accepted your credentials.');
            } else {
                setError(result.message ?? 'QRZ rejected your credentials.');
            }
        } catch (err) {
            console.error('Failed to test QRZ credentials:', err);
            setError(resolveErrorMessage(err, 'Failed to test your QRZ credentials.'));
        } finally {
            setTesting(false);
        }
    };

    const handleRemove = async () => {
        const confirmed = window.confirm(
            'Remove your QRZ credentials? QRZ lookups will be off for you until you add new credentials.'
        );
        if (!confirmed) {
            return;
        }

        try {
            setRemoving(true);
            setError(null);
            setSuccess(null);
            await deleteAccountQrz();
            setUsername('');
            setPassword('');
            setEditing(false);
            await onChanged();
            setSuccess('Your QRZ credentials were removed.');
        } catch (err) {
            console.error('Failed to remove QRZ credentials:', err);
            setError(resolveErrorMessage(err, 'Failed to remove your QRZ credentials.'));
        } finally {
            setRemoving(false);
        }
    };

    return (
        <section className={SECTION_CLASS}>
            <h2 className='text-lg font-semibold text-slate-100'>My QRZ Credentials</h2>
            {!isGlobal && (
                <p className='mt-1 mb-6 text-sm text-slate-400'>
                    Your own QRZ account is used for your callsign lookups. Passwords are encrypted at rest and never
                    displayed once saved.
                </p>
            )}

            {isGlobal ? (
                <p className='mt-1 text-sm text-slate-300'>Lookups use the organization&apos;s QRZ account.</p>
            ) : (
                <div className='space-y-6'>
                    <StatusBanners error={error} success={success} />

                    {account.configured && (
                        <div className='flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between'>
                            <div>
                                <p className='text-xs font-semibold uppercase tracking-[0.15em] text-slate-400'>
                                    Active Username
                                </p>
                                <div className='mt-2 text-lg font-medium text-slate-100'>
                                    {account.username}
                                </div>
                            </div>
                            <div className='flex flex-wrap gap-3'>
                                <button
                                    type='button'
                                    onClick={() => { void handleTest(); }}
                                    className={SECONDARY_BUTTON_CLASS}
                                    disabled={testing || saving || removing}
                                >
                                    <FiCheckCircle className='h-4 w-4' />
                                    {testing ? 'Testing…' : 'Test'}
                                </button>
                                <button
                                    type='button'
                                    onClick={() => {
                                        setEditing(value => !value);
                                        setPassword('');
                                    }}
                                    className={SECONDARY_BUTTON_CLASS}
                                    disabled={saving || removing}
                                >
                                    {editing ? 'Cancel' : 'Update'}
                                </button>
                                <button
                                    type='button'
                                    onClick={() => { void handleRemove(); }}
                                    className={DANGER_BUTTON_CLASS}
                                    disabled={removing || saving}
                                >
                                    <FiTrash2 className='h-4 w-4' />
                                    {removing ? 'Removing…' : 'Remove'}
                                </button>
                            </div>
                        </div>
                    )}

                    {showForm && (
                        <CredentialForm
                            username={username}
                            password={password}
                            saving={saving}
                            submitLabel='Save Credentials'
                            onUsernameChange={setUsername}
                            onPasswordChange={setPassword}
                            onSubmit={(event) => { void handleSubmit(event); }}
                        />
                    )}
                </div>
            )}
        </section>
    );
}

function ModeSection({ mode, onChanged }: { mode: QrzCredentialMode; onChanged: () => Promise<void> }) {
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleChange = async (next: QrzCredentialMode) => {
        if (next === mode) {
            return;
        }

        try {
            setSaving(true);
            setError(null);
            await updateQrzMode(next);
            await onChanged();
        } catch (err) {
            console.error('Failed to update QRZ credential mode:', err);
            setError(resolveErrorMessage(err, 'Failed to update QRZ credential mode.'));
        } finally {
            setSaving(false);
        }
    };

    const options: { value: QrzCredentialMode; label: string; description: string }[] = [
        {
            value: 'per_user',
            label: 'Per-user',
            description: 'Each user adds their own QRZ credentials. Users without credentials get no QRZ lookups.'
        },
        {
            value: 'global',
            label: 'Global',
            description: 'Everyone\'s lookups use the shared QRZ account configured below.'
        }
    ];

    return (
        <section className={SECTION_CLASS}>
            <h2 className='text-lg font-semibold text-slate-100'>QRZ Credential Mode</h2>
            <p className='mt-1 mb-6 text-sm text-slate-400'>
                Choose whose QRZ account NetMinder uses for lookups. Stored credentials are kept when you switch modes.
            </p>

            <div className='space-y-4'>
                {error && (
                    <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                        {error}
                    </div>
                )}

                {options.map(option => (
                    <label
                        key={option.value}
                        className='flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3'
                    >
                        <input
                            type='radio'
                            name='qrz-credential-mode'
                            value={option.value}
                            checked={mode === option.value}
                            onChange={() => { void handleChange(option.value); }}
                            disabled={saving}
                            className='mt-1'
                        />
                        <span>
                            <span className='block text-sm font-medium text-slate-100'>{option.label}</span>
                            <span className='block text-sm text-slate-400'>{option.description}</span>
                        </span>
                    </label>
                ))}
            </div>
        </section>
    );
}

function GlobalQrzSection({ mode }: { mode: QrzCredentialMode }) {
    const [status, setStatus] = useState<QrzSettingsStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);

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

        try {
            setSaving(true);
            setError(null);
            setSuccessMessage(null);

            const response = await withMinimumDelay(updateQrzSettings({
                username,
                password
            }));

            setStatus(response);
            setSuccessMessage('QRZ credentials updated successfully.');
            setPassword('');
        } catch (err) {
            console.error('Failed to update QRZ settings:', err);
            setError(resolveErrorMessage(err, 'Failed to update QRZ settings.'));
        } finally {
            setSaving(false);
        }
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

    const isConfigured = status?.configured ?? false;

    return (
        <section className={SECTION_CLASS}>
            <h2 className='text-lg font-semibold text-slate-100'>Global QRZ Credentials</h2>
            <p className='mt-1 mb-6 text-sm text-slate-400'>
                The shared account NetMinder uses to authenticate against the QRZ XML API.
                {mode === 'per_user' && ' Used only in Global mode.'}
            </p>

            {loading ? (
                <div className='flex h-40 items-center justify-center text-sm text-slate-400'>
                    Loading QRZ configuration…
                </div>
            ) : (
                <div className='space-y-6'>
                    <StatusBanners error={error} success={successMessage} />

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
                                className={DANGER_BUTTON_CLASS}
                                disabled={removing}
                            >
                                <FiTrash2 className='h-4 w-4' />
                                {removing ? 'Removing…' : 'Remove Credentials'}
                            </button>
                        </div>
                    ) : (
                        <CredentialForm
                            username={username}
                            password={password}
                            saving={saving}
                            submitLabel='Save Credentials'
                            onUsernameChange={setUsername}
                            onPasswordChange={setPassword}
                            onSubmit={(event) => { void handleSubmit(event); }}
                        />
                    )}
                </div>
            )}
        </section>
    );
}

function CheckinOptionsSection() {
    const { mobilityEnabled, refresh } = useAppConfig();
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleToggle = async (enabled: boolean) => {
        try {
            setSaving(true);
            setError(null);
            await updateAppSettings({ mobility_enabled: enabled });
            await refresh();
        } catch (err) {
            console.error('Failed to update app settings:', err);
            setError(resolveErrorMessage(err, 'Failed to update mobility tracking.'));
        } finally {
            setSaving(false);
        }
    };

    return (
        <section className={SECTION_CLASS}>
            <h2 className='text-lg font-semibold text-slate-100'>Check-in Options</h2>
            <p className='mt-1 mb-6 text-sm text-slate-400'>
                Choose which details operators record with each check-in.
            </p>

            <div className='space-y-4'>
                {error && (
                    <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                        {error}
                    </div>
                )}

                <label className='flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-700/70 bg-slate-950/60 px-4 py-3'>
                    <input
                        type='checkbox'
                        checked={mobilityEnabled}
                        onChange={(event) => { void handleToggle(event.target.checked); }}
                        disabled={saving}
                        className='mt-1 accent-indigo-500'
                    />
                    <span>
                        <span className='block text-sm font-medium text-slate-100'>
                            Enable mobility tracking
                            {saving && <span className='ml-2 text-xs text-slate-500'>Saving…</span>}
                        </span>
                        <span className='block text-sm text-slate-400'>
                            When disabled, mobility options are hidden and new check-ins are saved as fixed. Existing
                            mobility data is kept and returns if tracking is re-enabled.
                        </span>
                    </span>
                </label>
            </div>
        </section>
    );
}

function MapSection() {
    const { cartoApiKey, refresh } = useAppConfig();
    const [status, setStatus] = useState<MapSettings | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [keyInput, setKeyInput] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        void (async () => {
            try {
                setStatus(await fetchMapSettings());
            } catch (err) {
                console.error('Failed to load map settings:', err);
                setError(resolveErrorMessage(err, 'Failed to load map settings.'));
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const save = async (key: string | null) => {
        try {
            setSaving(true);
            setError(null);
            setStatus(await updateMapSettings({ carto_api_key: key }));
            setKeyInput('');
            await refresh();
        } catch (err) {
            console.error('Failed to update map settings:', err);
            setError(resolveErrorMessage(err, 'Failed to update map settings.'));
        } finally {
            setSaving(false);
        }
    };

    const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        void save(keyInput.trim());
    };

    const keySet = status?.carto_key_set ?? false;
    const previewUrl = cartoApiKey
        ? CARTO_DARK_URL
            .replace('{s}', 'a')
            .replace('{z}', '4')
            .replace('{x}', '4')
            .replace('{y}', '6')
            .replace('{r}', '')
            .replace('{key}', encodeURIComponent(cartoApiKey))
        : null;

    return (
        <section className={SECTION_CLASS}>
            <h2 className='text-lg font-semibold text-slate-100'>Map</h2>
            <p className='mt-1 mb-6 text-sm text-slate-400'>
                Dark mode uses a darkened OpenStreetMap. Add a free CARTO basemaps key for the CARTO Dark Matter map instead.
                <br />
                <a
                    href='https://carto.com/basemaps/apikey'
                    target='_blank'
                    rel='noreferrer'
                    className='text-indigo-400 underline hover:text-indigo-300'
                >
                    Get a key
                </a>
            </p>

            {loading ? (
                <div className='text-sm text-slate-400'>Loading map settings…</div>
            ) : (
                <div className='space-y-4'>
                    {error && (
                        <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className='space-y-2'>
                        <label htmlFor='carto-api-key' className='block text-sm font-medium text-slate-200'>CARTO API key</label>
                        <div className='flex flex-wrap items-center gap-3'>
                            <input
                                id='carto-api-key'
                                type='password'
                                autoComplete='off'
                                value={keyInput}
                                onChange={(event) => { setKeyInput(event.target.value); }}
                                placeholder={keySet && status?.carto_key_hint ? `•••• ${status.carto_key_hint}` : 'Paste your CARTO API key'}
                                disabled={saving}
                                className={`${INPUT_CLASS} max-w-sm flex-1`}
                            />
                            <button
                                type='submit'
                                disabled={saving || keyInput.trim() === ''}
                                className={PRIMARY_BUTTON_CLASS}
                            >
                                <FiSave className='h-4 w-4' />
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                            {keySet && (
                                <button
                                    type='button'
                                    disabled={saving}
                                    onClick={() => { void save(null); }}
                                    className={DANGER_BUTTON_CLASS}
                                >
                                    <FiTrash2 className='h-4 w-4' />
                                    Remove
                                </button>
                            )}
                        </div>
                    </form>

                    <p className='text-sm text-slate-300'>
                        In use:
                        {' '}
                        {keySet ? 'CARTO Dark Matter' : 'darkened OpenStreetMap'}
                    </p>

                    {keySet && previewUrl && (
                        <figure className='space-y-2'>
                            <img
                                src={previewUrl}
                                alt='CARTO Dark Matter sample tile'
                                width={128}
                                height={128}
                                referrerPolicy='strict-origin-when-cross-origin'
                                className='h-32 w-32 rounded-xl border border-slate-700/70'
                            />
                            <figcaption className='text-xs text-slate-400'>
                                If this shows an &apos;API key required&apos; watermark, the key isn&apos;t valid.
                            </figcaption>
                        </figure>
                    )}
                </div>
            )}
        </section>
    );
}

export function SettingsPage() {
    const { user } = useAuth();
    const isAdmin = Boolean(user?.is_admin);

    const [account, setAccount] = useState<AccountQrzStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAccount = useCallback(async () => {
        try {
            setError(null);
            setAccount(await fetchAccountQrz());
        } catch (err) {
            console.error('Failed to load QRZ settings:', err);
            setError(resolveErrorMessage(err, 'Failed to load QRZ settings.'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAccount();
    }, [loadAccount]);

    return (
        <div className='min-h-screen bg-slate-950'>
            <PageHeader />

            <main className='mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8'>
                <header className='mb-10 space-y-3'>
                    <span className='inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-indigo-400'>
                        <FiShield className='h-4 w-4' />
                        Configuration
                    </span>
                    <h1 className='text-3xl font-semibold text-slate-50 sm:text-4xl'>Settings</h1>
                    <p className='max-w-2xl text-sm text-slate-400'>
                        Your QRZ credentials, plus organization-wide options for admins.
                    </p>
                </header>

                {loading ? (
                    <div className='flex h-40 items-center justify-center text-sm text-slate-400'>
                        Loading QRZ configuration…
                    </div>
                ) : (
                    <div className='space-y-8'>
                        {error && (
                            <div className='rounded-2xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200'>
                                {error}
                            </div>
                        )}

                        {isAdmin && account && <SectionDivider label='Your settings' />}

                        {account && (
                            <MyQrzSection
                                key={account.mode}
                                account={account}
                                onChanged={loadAccount}
                            />
                        )}

                        {isAdmin && account && (
                            <>
                                <SectionDivider label='Organization settings' note='Admins only' />
                                <ModeSection mode={account.mode} onChanged={loadAccount} />
                                <GlobalQrzSection mode={account.mode} />
                                <CheckinOptionsSection />
                                <MapSection />
                            </>
                        )}
                    </div>
                )}
            </main>
        </div>
    );
}