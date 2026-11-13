import {
    useEffect,
    useState
} from 'react';
import { PiWarningBold } from 'react-icons/pi';

import { Button } from './Button';
import { Input } from './Input';

interface UserFormProps {
    mode: 'create' | 'edit';
    initialData?: {
        id: number;
        username: string;
        full_name: string;
        is_admin: boolean;
    };
    onSubmit: (data: UserFormData) => Promise<void>;
    onCancel: () => void;
    loading?: boolean;
    isInitialAdmin?: boolean;
    showAdminInfo?: boolean;
    allowPasswordChange?: boolean;
}

export interface UserFormData {
    username: string;
    full_name: string;
    is_admin: boolean;
    password?: string;
}

export function UserForm({
    mode,
    initialData,
    onSubmit,
    onCancel,
    loading = false,
    isInitialAdmin = false,
    showAdminInfo = true,
    allowPasswordChange = false
}: UserFormProps) {
    const [username, setUsername] = useState(initialData?.username ?? '');
    const [fullName, setFullName] = useState(initialData?.full_name ?? '');
    const [errors, setErrors] = useState<Record<string, string>>({});
    const isAdmin = initialData?.is_admin ?? false;
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    useEffect(() => {
        if (initialData) {
            setUsername(initialData.username);
            setFullName(initialData.full_name);
        }
    }, [initialData]);

    useEffect(() => {
        if (mode === 'edit') {
            setNewPassword('');
            setConfirmPassword('');
        }
    }, [initialData, mode, allowPasswordChange]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        // Username validation
        if (!username.trim()) {
            newErrors.username = 'Username is required';
        }

        if (!fullName.trim()) {
            newErrors.full_name = 'Full name is required';
        }

        if (allowPasswordChange && (newPassword || confirmPassword)) {
            if (newPassword.length < 8) {
                newErrors.password = 'Password must be at least 8 characters';
            }
            if (confirmPassword.length === 0) {
                newErrors.confirmPassword = 'Please confirm the new password';
            } else if (newPassword !== confirmPassword) {
                newErrors.confirmPassword = 'Passwords do not match';
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validate()) {
            return;
        }

        const formData: UserFormData = {
            username: username.trim(),
            full_name: fullName.trim(),
            is_admin: isAdmin
        };

        if (allowPasswordChange && newPassword.length > 0) {
            formData.password = newPassword;
        }

        try {
            await onSubmit(formData);
        } catch (error) {
            // Error handling is done by the parent component
            console.error('Form submission error:', error);
        }
    };

    return (
        <form onSubmit={(e) => { void handleSubmit(e); }} className='space-y-4'>
            <Input
                label='Username'
                type='text'
                value={username}
                onChange={(e) => { setUsername(e.target.value); }}
                error={errors.username}
                disabled={loading}
                required
                autoFocus
            />

            <Input
                label='Full Name'
                type='text'
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); }}
                error={errors.full_name}
                disabled={loading}
                required
            />

            {allowPasswordChange && mode === 'edit' && (
                <div className='space-y-2'>
                    <Input
                        label='New Password'
                        type='password'
                        value={newPassword}
                        onChange={(e) => { setNewPassword(e.target.value); }}
                        error={errors.password}
                        disabled={loading}
                        placeholder='Leave blank to keep current password'
                    />
                    <Input
                        label='Confirm New Password'
                        type='password'
                        value={confirmPassword}
                        onChange={(e) => { setConfirmPassword(e.target.value); }}
                        error={errors.confirmPassword}
                        disabled={loading}
                        placeholder='Re-enter new password'
                    />
                    <p className='text-xs text-slate-500'>Leave both fields empty to keep the current password.</p>
                </div>
            )}

            {mode === 'edit' && showAdminInfo && isAdmin && (
                <div className='space-y-2'>
                    <div className='flex items-start gap-3'>
                        <input
                            type='checkbox'
                            checked
                            readOnly
                            disabled
                            aria-readonly='true'
                            className='mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50'
                        />
                        <div className='flex-1'>
                            <div className='text-sm font-medium text-slate-200'>
                                Administrator
                            </div>
                            <div className='text-xs text-slate-400'>
                                {isInitialAdmin
                                    ? 'This is the original system administrator created during installation.'
                                    : 'Administrator access for this user is managed outside of this screen.'}
                            </div>
                        </div>
                    </div>

                    <div className='rounded-lg border border-amber-900/50 bg-amber-950/30 p-3'>
                        <div className='flex gap-2'>
                            <PiWarningBold className='h-5 w-5 flex-shrink-0 text-amber-500' />
                            <div className='text-xs text-amber-200'>
                                There can only be a single administrator on this system.
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className='flex gap-3 pt-2'>
                <Button
                    type='submit'
                    variant='primary'
                    loading={loading}
                    className='flex-1'
                >
                    {mode === 'create' ? 'Create User' : 'Save Changes'}
                </Button>
                <Button
                    type='button'
                    variant='secondary'
                    onClick={onCancel}
                    disabled={loading}
                    className='flex-1'
                >
                    Cancel
                </Button>
            </div>
        </form>
    );
}