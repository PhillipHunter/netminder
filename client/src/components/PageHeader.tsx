import { FaRadio } from 'react-icons/fa6';
import {
    Link,
    useLocation
} from 'react-router-dom';

import { useAuth } from '../contexts/AuthContext';

export function PageHeader() {
    const location = useLocation();
    const { user, logout } = useAuth();
    const isAdmin = Boolean(user?.is_admin);

    return (
        <header className='border-b border-slate-700/50 bg-gradient-to-r from-slate-900/95 via-slate-800/95 to-slate-900/95 backdrop-blur-lg shadow-lg shadow-black/20'>
            <div className='mx-auto px-4 sm:px-6 lg:px-8'>
                <div className='flex h-16 items-center justify-between'>
                    <div className='flex items-center gap-8'>
                        <Link to='/' className='flex items-center gap-2 group'>
                            <div className='h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 p-1.5 shadow-md shadow-indigo-500/25 transition-all duration-200 group-hover:shadow-lg group-hover:shadow-indigo-500/35 group-hover:scale-110'>
                                <FaRadio className='h-full w-full text-white' />
                            </div>
                            <span className='text-xl font-bold bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent'>netMinder</span>
                        </Link>

                        {user && (
                            <nav className='flex gap-2'>
                                <Link
                                    to='/'
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                        location.pathname === '/'
                                            ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-slate-100 border border-indigo-500/30'
                                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                                    }`}
                                >
                                    Dashboard
                                </Link>
                                <Link
                                    to='/stations'
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                        location.pathname === '/stations'
                                            ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-slate-100 border border-indigo-500/30'
                                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                                    }`}
                                >
                                    Stations
                                </Link>
                                {isAdmin && (
                                    <Link
                                        to='/users'
                                        className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                            location.pathname === '/users'
                                                ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-slate-100 border border-indigo-500/30'
                                                : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                                        }`}
                                    >
                                        Users
                                    </Link>
                                )}
                                <Link
                                    to='/settings'
                                    className={`rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 ${
                                        location.pathname === '/settings'
                                            ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 text-slate-100 border border-indigo-500/30'
                                            : 'text-slate-300 hover:bg-slate-700/50 hover:text-slate-100'
                                    }`}
                                >
                                    Settings
                                </Link>
                            </nav>
                        )}
                    </div>

                    {user && (
                        <div className='flex items-center gap-4'>
                            <div className='flex items-center gap-2 rounded-lg border border-slate-700/50 bg-gradient-to-r from-slate-800/70 to-slate-900/70 px-3 py-1.5 shadow-lg shadow-black/20'>
                                <div className='h-6 w-6 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 p-1'>
                                    <svg
                                        className='h-full w-full text-indigo-300'
                                        fill='none'
                                        stroke='currentColor'
                                        viewBox='0 0 24 24'
                                        xmlns='http://www.w3.org/2000/svg'
                                    >
                                        <path
                                            strokeLinecap='round'
                                            strokeLinejoin='round'
                                            strokeWidth={2}
                                            d='M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z'
                                        />
                                    </svg>
                                </div>
                                <div className='flex flex-col leading-tight'>
                                    <span className='text-sm font-medium text-slate-200'>
                                        {user.full_name}
                                    </span>
                                    <span className='text-xs text-slate-400'>
                                        @
                                        {user.username}
                                    </span>
                                </div>
                                {isAdmin && (
                                    <span className='rounded-full bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 px-2 py-0.5 text-xs font-medium text-indigo-300'>
                                        Admin
                                    </span>
                                )}
                            </div>
                            <button
                                onClick={logout}
                                className='rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-all duration-200 hover:bg-slate-700/50 hover:text-slate-100'
                                aria-label='Logout'
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}