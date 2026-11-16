import {
    useCallback,
    useEffect,
    useState
} from 'react';
import {
    FaEdit,
    FaKey,
    FaTrash
} from 'react-icons/fa';

import type {
    UpdateUserPayload,
    UserWithNetCount
} from '../api';
import {
    createUser,
    deleteUser,
    fetchUsers,
    resetUserPassword,
    updateUser
} from '../api';
import { Button } from '../components/Button';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import {
    UserForm,
    type UserFormData
} from '../components/UserForm';
import { useAuth } from '../contexts/AuthContext';
import { resolveErrorMessage } from '../utils/errors';

interface CredentialNotice {
    type: 'created' | 'reset';
    username: string;
    fullName: string;
    temporaryPassword: string;
}

export function UsersPage() {
    const { user: currentUser, checkAuth } = useAuth();
    const [users, setUsers] = useState<UserWithNetCount[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [credentialNotice, setCredentialNotice] = useState<CredentialNotice | null>(null);
    const [credentialCopyState, setCredentialCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
    const [resettingUserId, setResettingUserId] = useState<number | null>(null);
    const [isResetModalOpen, setIsResetModalOpen] = useState(false);
    const [resetTargetUser, setResetTargetUser] = useState<UserWithNetCount | null>(null);
    const [resetError, setResetError] = useState<string | null>(null);

    // Modal states
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<UserWithNetCount | null>(null);

    // Form states
    const [formLoading, setFormLoading] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);

    // Fetch users
    const loadUsers = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);
            const response = await fetchUsers();
            setUsers(response);
        } catch (err) {
            console.error('Error fetching users:', err);
            setError(resolveErrorMessage(err, 'Failed to fetch users'));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadUsers();
    }, [loadUsers]);

    // Handle create user
    const handleCreateUser = async (data: UserFormData) => {
        try {
            setFormLoading(true);
            setFormError(null);

            const username = data.username.trim();
            const fullName = data.full_name.trim();

            if (!username) {
                const message = 'Username is required';
                setFormError(message);
                throw new Error(message);
            }

            if (!fullName) {
                const message = 'Full name is required';
                setFormError(message);
                throw new Error(message);
            }

            const response = await createUser({
                username,
                full_name: fullName,
                is_admin: data.is_admin
            });

            setCredentialNotice({
                type: 'created',
                username: response.user.username,
                fullName: response.user.full_name,
                temporaryPassword: response.temporary_password
            });
            setCredentialCopyState('idle');
            setIsAddModalOpen(false);
            void loadUsers();
        } catch (err) {
            console.error('Error creating user:', err);
            setFormError(resolveErrorMessage(err, 'Failed to create user'));
            throw err; // Re-throw to prevent modal from closing
        } finally {
            setFormLoading(false);
        }
    };

    // Handle update user
    const handleUpdateUser = async (data: UserFormData) => {
        if (!selectedUser)
            return;

        try {
            setFormLoading(true);
            setFormError(null);

            const username = data.username.trim();
            const fullName = data.full_name.trim();
            if (!username) {
                const message = 'Username is required';
                setFormError(message);
                throw new Error(message);
            }

            if (!fullName) {
                const message = 'Full name is required';
                setFormError(message);
                throw new Error(message);
            }

            const updateData: UpdateUserPayload = {
                username,
                full_name: fullName,
                is_admin: data.is_admin
            };

            if (data.password && data.password.trim().length > 0) {
                updateData.password = data.password;
            }

            const targetUserId = selectedUser.id;
            await updateUser(targetUserId, updateData);

            if (currentUser?.id === targetUserId) {
                await checkAuth();
            }

            setIsEditModalOpen(false);
            setSelectedUser(null);
            void loadUsers();
        } catch (err) {
            console.error('Error updating user:', err);
            setFormError(resolveErrorMessage(err, 'Failed to update user'));
            throw err; // Re-throw to prevent modal from closing
        } finally {
            setFormLoading(false);
        }
    };

    // Handle delete user
    const handleDeleteUser = async () => {
        if (!selectedUser)
            return;

        try {
            setFormLoading(true);
            setFormError(null);

            await deleteUser(selectedUser.id);

            setIsDeleteModalOpen(false);
            setSelectedUser(null);
            void loadUsers();
        } catch (err) {
            console.error('Error deleting user:', err);
            setFormError(resolveErrorMessage(err, 'Failed to delete user'));
        } finally {
            setFormLoading(false);
        }
    };

    const openResetModal = (user: UserWithNetCount) => {
        setResetTargetUser(user);
        setResetError(null);
        setIsResetModalOpen(true);
    };

    const closeResetModal = () => {
        setIsResetModalOpen(false);
        setResetTargetUser(null);
        setResetError(null);
    };

    const performPasswordReset = async () => {
        if (!resetTargetUser) {
            return;
        }

        try {
            setResettingUserId(resetTargetUser.id);
            setResetError(null);

            const response = await resetUserPassword(resetTargetUser.id);
            setCredentialNotice({
                type: 'reset',
                username: response.user.username,
                fullName: response.user.full_name,
                temporaryPassword: response.temporary_password
            });
            setCredentialCopyState('idle');
            closeResetModal();
            void loadUsers();
        } catch (err) {
            console.error('Error resetting user password:', err);
            setResetError(resolveErrorMessage(err, 'Failed to reset password'));
        } finally {
            setResettingUserId(null);
        }
    };

    // Open edit modal
    const openEditModal = (user: UserWithNetCount) => {
        setSelectedUser(user);
        setFormError(null);
        setIsEditModalOpen(true);
    };

    // Open delete modal
    const openDeleteModal = (user: UserWithNetCount) => {
        if (user.is_admin) {
            return;
        }
        setSelectedUser(user);
        setFormError(null);
        setIsDeleteModalOpen(true);
    };

    // Close modals
    const closeAddModal = () => {
        setIsAddModalOpen(false);
        setFormError(null);
    };

    const closeEditModal = () => {
        setIsEditModalOpen(false);
        setSelectedUser(null);
        setFormError(null);
    };

    const closeDeleteModal = () => {
        setIsDeleteModalOpen(false);
        setSelectedUser(null);
        setFormError(null);
    };

    // Format timestamps for display
    const formatDateTime = (dateString: string | null | undefined, fallback = 'Unknown') => {
        if (!dateString) {
            return fallback;
        }

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            return fallback;
        }

        return date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatLastLogin = (dateString: string | null | undefined) => {
        if (!dateString) {
            return {
                label: 'Never',
                tooltip: 'User has not logged in yet'
            };
        }

        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) {
            return {
                label: 'Unknown',
                tooltip: 'Timestamp unavailable'
            };
        }

        const tooltip = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });

        const diffMs = Date.now() - date.getTime();
        if (diffMs <= 0) {
            return {
                label: 'Just now',
                tooltip
            };
        }

        const totalMinutes = Math.floor(diffMs / 60000);
        const units = [
            { label: 'd', minutes: 1440 },
            { label: 'h', minutes: 60 },
            { label: 'm', minutes: 1 }
        ];

        const parts: string[] = [];
        let remainder = totalMinutes;

        for (const unit of units) {
            if (parts.length === 2) {
                break;
            }

            const value = Math.floor(remainder / unit.minutes);
            if (value > 0) {
                parts.push(`${value}${unit.label}`);
                remainder -= value * unit.minutes;
            }
        }

        if (parts.length === 0) {
            parts.push('0m');
        }

        return {
            label: `${parts.join(' ')} ago`,
            tooltip
        };
    };

    const buildCredentialMessage = (info: CredentialNotice) => {
        const lines = [
            info.type === 'created'
                ? 'A new netMinder account has been created.'
                : 'The netMinder password for this account has been reset.',
            `Name: ${info.fullName}`,
            `Username: ${info.username}`,
            `Temporary Password: ${info.temporaryPassword}`,
            '',
            'This password must be changed on first login.'
        ];

        return lines.join('\n');
    };

    const handleCopyCredentials = async () => {
        if (!credentialNotice) {
            return;
        }

        const text = buildCredentialMessage(credentialNotice);

        try {
            if (
                typeof navigator !== 'undefined'
                && typeof navigator.clipboard !== 'undefined'
                && typeof navigator.clipboard.writeText === 'function'
            ) {
                await navigator.clipboard.writeText(text);
            } else {
                throw new Error('Clipboard API is not available');
            }

            setCredentialCopyState('copied');
        } catch (copyError) {
            console.error('Failed to copy credentials to clipboard:', copyError);
            setCredentialCopyState('error');
        }
    };

    const closeCredentialModal = () => {
        setCredentialNotice(null);
        setCredentialCopyState('idle');
    };

    const credentialText = credentialNotice ? buildCredentialMessage(credentialNotice) : '';

    return (
        <div className='min-h-screen bg-slate-950'>
            <PageHeader />

            <main className='mx-auto px-6 py-10'>
                <div className='rounded-2xl border border-slate-800/80 bg-slate-900/80 p-8 shadow-lg backdrop-blur-xl'>
                    <div className='mb-6 flex items-center justify-between'>
                        <h2 className='text-2xl font-semibold text-slate-100'>
                            User Management
                        </h2>
                        <button
                            onClick={() => { setIsAddModalOpen(true); }}
                            className='rounded-full bg-sky-500 px-6 py-2 text-sm font-semibold uppercase tracking-wide text-slate-950 transition hover:bg-sky-400'
                        >
                            Add User
                        </button>
                    </div>

                    {error && (
                        <div className='mb-6 rounded-lg border border-red-900/50 bg-red-950/30 p-4'>
                            <div className='flex gap-3'>
                                <svg
                                    className='h-5 w-5 flex-shrink-0 text-red-500'
                                    fill='none'
                                    stroke='currentColor'
                                    viewBox='0 0 24 24'
                                >
                                    <path
                                        strokeLinecap='round'
                                        strokeLinejoin='round'
                                        strokeWidth={2}
                                        d='M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
                                    />
                                </svg>
                                <div className='flex-1'>
                                    <h3 className='text-sm font-semibold text-red-200'>Error</h3>
                                    <p className='mt-1 text-sm text-red-300'>{error}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {loading ? (
                        <div className='flex justify-center py-12'>
                            <div className='inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-sky-500 border-r-transparent'></div>
                        </div>
                    ) : users.length === 0 ? (
                        <div className='py-12 text-center'>
                            <p className='text-slate-400'>No users found</p>
                        </div>
                    ) : (
                        <div className='overflow-hidden rounded-lg border border-slate-800'>
                            <table className='w-full'>
                                <thead className='bg-slate-800/50'>
                                    <tr>
                                        <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300'>
                                            Username
                                        </th>
                                        <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300'>
                                            Name
                                        </th>
                                        <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300'>
                                            Role
                                        </th>
                                        <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300'>
                                            Created
                                        </th>
                                        <th className='px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300'>
                                            Last Login
                                        </th>
                                        <th className='px-6 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-300'>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className='divide-y divide-slate-800'>
                                    {users.map((user) => {
                                        const lastLogin = formatLastLogin(user.last_login_at);
                                        const createdLabel = formatDateTime(user.created_at, 'Unknown');
                                        const hideOwnReset = Boolean(currentUser && currentUser.id === user.id && currentUser.is_admin);
                                        const isResetting = resettingUserId === user.id;
                                        const resetButtonText = isResetting ? 'Resetting password' : 'Reset password';
                                        const resetAriaLabel = `${resetButtonText} for ${user.username}`;
                                        const isAdminUser = user.is_admin;
                                        const canDelete = !isAdminUser;

                                        return (
                                            <tr
                                                key={user.id}
                                                className='transition hover:bg-slate-800/30'
                                            >
                                                <td className='px-6 py-4'>
                                                    <div className='flex flex-col gap-1'>
                                                        <div className='flex items-center gap-2'>
                                                            <span className='text-sm font-medium text-slate-100'>
                                                                {user.username}
                                                            </span>
                                                            {currentUser?.id === user.id && (
                                                                <span className='rounded bg-slate-700 px-2 py-0.5 text-xs text-slate-300'>
                                                                    You
                                                                </span>
                                                            )}
                                                        </div>
                                                        {user.must_change_password && (
                                                            <span className='w-fit rounded border border-amber-700/40 bg-amber-900/20 px-1.5 py-0.5 text-[11px] font-medium text-amber-200/90'>
                                                                Password change required
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className='px-6 py-4 text-sm font-medium text-slate-100'>
                                                    {user.full_name}
                                                </td>
                                                <td className='px-6 py-4'>
                                                    {user.is_admin ? (
                                                        <span className='inline-flex items-center rounded-full border border-violet-700/70 bg-violet-950/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-400'>
                                                            Admin
                                                        </span>
                                                    ) : (
                                                        <span className='inline-flex items-center rounded-full border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                                            User
                                                        </span>
                                                    )}
                                                </td>
                                                <td className='px-6 py-4 text-sm text-slate-400'>
                                                    {createdLabel}
                                                </td>
                                                <td className='px-6 py-4 text-sm text-slate-400'>
                                                    <span title={lastLogin.tooltip}>{lastLogin.label}</span>
                                                </td>
                                                <td className='px-6 py-4'>
                                                    <div className='flex justify-end gap-2'>
                                                        <button
                                                            onClick={() => { openEditModal(user); }}
                                                            className='rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-slate-100'
                                                            aria-label={`Edit ${user.username}`}
                                                            title={`Edit ${user.username}`}
                                                        >
                                                            <FaEdit className='h-4 w-4' aria-hidden='true' />
                                                            <span className='sr-only'>Edit user</span>
                                                        </button>
                                                        {!hideOwnReset && (
                                                            <button
                                                                onClick={() => { openResetModal(user); }}
                                                                disabled={isResetting}
                                                                className='rounded-lg border border-amber-800/60 bg-amber-900/30 px-2 py-1.5 text-xs text-amber-300 transition hover:border-amber-700 hover:bg-amber-900/50 hover:text-amber-100 disabled:cursor-not-allowed disabled:opacity-50'
                                                                aria-label={resetAriaLabel}
                                                                title={resetButtonText}
                                                            >
                                                                <FaKey
                                                                    className={`h-4 w-4 ${isResetting ? 'animate-spin text-amber-200' : ''}`}
                                                                    aria-hidden='true'
                                                                />
                                                                <span className='sr-only'>
                                                                    {resetButtonText}
                                                                </span>
                                                            </button>
                                                        )}
                                                        {canDelete && (
                                                            <button
                                                                onClick={() => { openDeleteModal(user); }}
                                                                className='rounded-lg border border-red-900/50 bg-red-950/30 px-2 py-1.5 text-xs text-red-400 transition hover:border-red-800 hover:bg-red-950/50 hover:text-red-300'
                                                                aria-label={`Delete ${user.username}`}
                                                                title={`Delete ${user.username}`}
                                                            >
                                                                <FaTrash className='h-4 w-4' aria-hidden='true' />
                                                                <span className='sr-only'>Delete user</span>
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Add User Modal */}
            <Modal
                isOpen={isAddModalOpen}
                onClose={closeAddModal}
                title='Add User'
            >
                {formError && (
                    <div className='mb-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3'>
                        <p className='text-sm text-red-300'>{formError}</p>
                    </div>
                )}
                <UserForm
                    mode='create'
                    onSubmit={handleCreateUser}
                    onCancel={closeAddModal}
                    loading={formLoading}
                />
            </Modal>

            {/* Edit User Modal */}
            <Modal
                isOpen={isEditModalOpen}
                onClose={closeEditModal}
                title='Edit User'
            >
                {formError && (
                    <div className='mb-4 rounded-lg border border-red-900/50 bg-red-950/30 p-3'>
                        <p className='text-sm text-red-300'>{formError}</p>
                    </div>
                )}
                {selectedUser && (
                    <UserForm
                        mode='edit'
                        initialData={selectedUser}
                        onSubmit={handleUpdateUser}
                        onCancel={closeEditModal}
                        loading={formLoading}
                        isInitialAdmin={selectedUser.id === 1}
                        showAdminInfo={Boolean(currentUser?.is_admin)}
                        allowPasswordChange={Boolean(currentUser && currentUser.id === selectedUser.id)}
                    />
                )}
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={isDeleteModalOpen}
                onClose={closeDeleteModal}
                title='Delete User'
            >
                {selectedUser && (
                    <div className='space-y-4'>
                        {formError && (
                            <div className='rounded-lg border border-red-900/50 bg-red-950/30 p-3'>
                                <p className='text-sm text-red-300'>{formError}</p>
                            </div>
                        )}

                        <p className='text-slate-300'>
                            Are you sure you want to delete the user
                            {' '}
                            <strong className='text-slate-100'>{selectedUser.username}</strong>
                            ?
                        </p>

                        <p className='text-sm text-slate-400'>
                            {selectedUser.private_net_count > 0 && (
                                <>
                                    {`This user's ${selectedUser.private_net_count} private ${selectedUser.private_net_count === 1 ? 'net' : 'nets'} will be permanently deleted. `}
                                </>
                            )}
                            Their shared nets will be transferred to you.
                        </p>

                        {currentUser?.id === selectedUser.id && (
                            <div className='rounded-lg border border-amber-900/50 bg-amber-950/30 p-3'>
                                <div className='flex gap-2'>
                                    <svg
                                        className='h-5 w-5 flex-shrink-0 text-amber-500'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                                        />
                                    </svg>
                                    <div className='text-xs text-amber-200'>
                                        <strong>Warning:</strong>
                                        {' '}
                                        You are about to delete your own account.
                                        You will be logged out immediately.
                                    </div>
                                </div>
                            </div>
                        )}

                        {selectedUser.is_admin && (
                            <div className='rounded-lg border border-red-900/50 bg-red-950/30 p-3'>
                                <div className='flex gap-2'>
                                    <svg
                                        className='h-5 w-5 flex-shrink-0 text-red-500'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z'
                                        />
                                    </svg>
                                    <div className='text-xs text-red-200'>
                                        <strong>Warning:</strong>
                                        {' '}
                                        This is an admin account. If this is the
                                        last admin, deletion will be prevented.
                                    </div>
                                </div>
                            </div>
                        )}

                        <p className='text-sm text-slate-400'>
                            This action cannot be undone.
                        </p>

                        <div className='flex gap-3 pt-2'>
                            <button
                                onClick={() => { void handleDeleteUser(); }}
                                disabled={formLoading}
                                className='flex-1 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50'
                            >
                                {formLoading ? 'Deleting...' : 'Delete User'}
                            </button>
                            <button
                                onClick={closeDeleteModal}
                                disabled={formLoading}
                                className='flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Reset Password Confirmation Modal */}
            <Modal
                isOpen={isResetModalOpen}
                onClose={closeResetModal}
                title='Reset Password'
            >
                {resetTargetUser && (
                    <div className='space-y-4'>
                        {resetError && (
                            <div className='rounded-lg border border-red-900/50 bg-red-950/30 p-3'>
                                <p className='text-sm text-red-300'>{resetError}</p>
                            </div>
                        )}

                        <p className='text-slate-300'>
                            This will generate a new temporary password for
                            {' '}
                            <strong className='text-slate-100'>{resetTargetUser.full_name}</strong>
                            (
                            <span className='text-slate-200'>
                                @
                                {resetTargetUser.username}
                            </span>
                            ). Share the generated credentials with them immediately.
                        </p>

                        <p className='text-sm text-slate-400'>
                            The user will be required to choose a new password when they next sign in.
                        </p>

                        <div className='flex gap-3 pt-2'>
                            <button
                                onClick={() => { void performPasswordReset(); }}
                                disabled={resettingUserId === resetTargetUser.id}
                                className='flex-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-amber-500 disabled:cursor-not-allowed disabled:opacity-60'
                            >
                                {resettingUserId === resetTargetUser.id ? 'Generating...' : 'Reset Password'}
                            </button>
                            <button
                                onClick={closeResetModal}
                                disabled={resettingUserId === resetTargetUser.id}
                                className='flex-1 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50'
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal
                isOpen={credentialNotice !== null}
                onClose={closeCredentialModal}
                title={credentialNotice?.type === 'reset' ? 'Password Reset' : 'User Created'}
            >
                {credentialNotice && (
                    <div className='space-y-4'>
                        <p className='text-sm text-slate-300'>
                            Share the details below with
                            {' '}
                            <strong className='text-slate-100'>{credentialNotice.fullName}</strong>
                            . They will be asked to change this password after signing in.
                        </p>

                        <div className='rounded-lg border border-slate-700 bg-slate-900/60 p-4'>
                            <pre className='whitespace-pre-wrap font-mono text-sm text-slate-100'>{credentialText}</pre>
                        </div>

                        {credentialCopyState === 'copied' && (
                            <p className='text-xs text-emerald-300'>Credentials copied to clipboard.</p>
                        )}
                        {credentialCopyState === 'error' && (
                            <p className='text-xs text-red-300'>Copy failed. Please copy the information manually.</p>
                        )}

                        <div className='flex gap-3 pt-2'>
                            <Button
                                type='button'
                                variant='primary'
                                onClick={() => { void handleCopyCredentials(); }}
                            >
                                Copy to Clipboard
                            </Button>
                            <Button
                                type='button'
                                variant='secondary'
                                onClick={closeCredentialModal}
                            >
                                Done
                            </Button>
                        </div>
                    </div>
                )}
            </Modal>
        </div>
    );
}