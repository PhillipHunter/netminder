import {
    useCallback,
    useEffect,
    useRef,
    useState
} from 'react';
import { FaTrash } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

import type { NetListItem } from '../api';
import {
    createNet,
    deleteNet,
    fetchNets,
    isNotFoundError
} from '../api';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import {
    formatDurationLabel,
    getDurationMinutes
} from '../utils/duration';
import { resolveErrorMessage } from '../utils/errors';

export const Dashboard = () => {
    const navigate = useNavigate();
    const [nets, setNets] = useState<NetListItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newNetTopic, setNewNetTopic] = useState('');
    const [isCreating, setIsCreating] = useState(false);
    const [endOtherActiveNets, setEndOtherActiveNets] = useState(false);
    const [sharedNet, setSharedNet] = useState(false);

    // Pagination state
    const [currentPage, setCurrentPage] = useState(0);
    const [pageSize] = useState(10);
    const [totalNets, setTotalNets] = useState(0);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasExactTotal, setHasExactTotal] = useState(false);
    const isFetchingRef = useRef(false);

    // Delete confirmation modal
    const [netToDelete, setNetToDelete] = useState<NetListItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Find the latest in-progress net (started but not ended)
    const latestInProgressNet = nets.find(net => net.started_at !== null && net.ended_at === null);

    const pageStart = nets.length > 0 ? currentPage * pageSize + 1 : 0;
    const pageEnd = currentPage * pageSize + nets.length;
    const totalDisplay = hasExactTotal ? totalNets : (hasNextPage ? `${pageEnd}+` : totalNets);

    interface LoadOptions {
        background?: boolean;
        isStopped?: () => boolean;
    }

    const loadNets = useCallback(async ({ background = false, isStopped = () => false }: LoadOptions = {}) => {
        if (background && isFetchingRef.current) {
            return;
        }

        try {
            isFetchingRef.current = true;
            if (!background) {
                setLoading(true);
                setError(null);
            }
            const offset = currentPage * pageSize;
            const result = await fetchNets(pageSize, offset);
            if (isStopped()) {
                return;
            }
            const fetchedNets = result.nets;

            if (fetchedNets.length === 0 && currentPage > 0) {
                setCurrentPage(p => Math.max(0, p - 1));
                return;
            }

            const total = result.meta.total;
            const nextPageAvailable = result.meta.hasMore;
            const metaHasTotal = true;

            setHasNextPage(nextPageAvailable);
            setNets(fetchedNets);
            setTotalNets(total);
            setHasExactTotal(metaHasTotal);
        } catch (err) {
            if (isStopped()) {
                return;
            }
            if (background) {
                console.error('Error refreshing nets:', err);
            } else {
                setError(resolveErrorMessage(err, 'An error occurred'));
            }
        } finally {
            isFetchingRef.current = false;
            if (!background && !isStopped()) {
                setLoading(false);
            }
        }
    }, [currentPage, pageSize]);

    useEffect(() => {
        const polling = { stopped: false };
        const isStopped = () => polling.stopped;
        const refresh = () => { void loadNets({ background: true, isStopped }); };
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                refresh();
            }
        };

        void loadNets({ isStopped });

        // Keep the list current as nets are shared, hidden, or ended elsewhere
        const interval = setInterval(refresh, 10000);
        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            polling.stopped = true;
            clearInterval(interval);
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [loadNets]);

    const handleCreateNet = async () => {
        try {
            setIsCreating(true);
            const payload = {
                topic: newNetTopic.trim() || undefined,
                end_active: endOtherActiveNets || undefined,
                shared: sharedNet || undefined
            };
            const newNet = await createNet(payload);

            // Navigate to the new net
            void navigate(`/nets/${newNet.id}`);
        } catch (err) {
            setError(resolveErrorMessage(err, 'Failed to create net'));
        } finally {
            setIsCreating(false);
            setIsModalOpen(false);
            setNewNetTopic('');
            setEndOtherActiveNets(false);
            setSharedNet(false);
        }
    };

    const handleResumeLatest = () => {
        if (latestInProgressNet) {
            void navigate(`/nets/${latestInProgressNet.id}`);
        }
    };

    const handleModalSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        void handleCreateNet();
    };
    const handleModalClose = () => {
        setIsModalOpen(false);
        setNewNetTopic('');
        setEndOtherActiveNets(false);
        setSharedNet(false);
    };

    const handleDeleteNet = async () => {
        if (!netToDelete)
            return;

        try {
            setIsDeleting(true);
            await deleteNet(netToDelete.id);

            // Refresh the nets list
            await loadNets();
            setNetToDelete(null);
        } catch (err) {
            if (isNotFoundError(err)) {
                setNetToDelete(null);
                void loadNets({ background: true });
                return;
            }
            setError(resolveErrorMessage(err, 'Failed to delete net'));
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className='min-h-screen'>
            <PageHeader />
            <div className='mx-auto px-4 py-8 sm:px-6 lg:px-8'>
                <div className='mb-8'>
                    <h1 className='text-3xl font-bold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-300 bg-clip-text text-transparent'>Dashboard</h1>
                    <p className='mt-2 text-slate-400'>Manage your nets and check-ins</p>
                </div>

                {/* CTA Buttons */}
                <div className='mb-8 flex flex-wrap gap-4'>
                    <button
                        onClick={() => { setIsModalOpen(true); }}
                        className='inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500 px-6 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/30 hover:scale-105 active:scale-95'
                        style={{ backgroundSize: '200% 100%' }}
                    >
                        <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
                        </svg>
                        Create New Net
                    </button>

                    {latestInProgressNet && (
                        <button
                            onClick={handleResumeLatest}
                            className='inline-flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 px-6 py-3 text-sm font-semibold text-emerald-300 shadow-md shadow-emerald-500/15 transition-all duration-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/25 hover:scale-105 active:scale-95'
                        >
                            <span className='h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(74,222,128,0.6)] animate-pulse' />
                            Resume Latest Net
                        </button>
                    )}
                </div>

                {/* Error Display */}
                {error && (
                    <div className='mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4'>
                        <p className='text-sm text-red-300'>{error}</p>
                    </div>
                )}

                {/* Recent Nets */}
                <div className='mb-4'>
                    <h2 className='text-xl font-semibold text-slate-200'>Recent Nets</h2>
                    <p className='mt-1 text-sm text-slate-400'>View and manage your net sessions</p>
                </div>

                {loading ? (
                    <div className='flex items-center justify-center rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-12 shadow-lg shadow-black/20'>
                        <div className='text-center'>
                            <div className='mx-auto h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-indigo-400' />
                            <p className='mt-4 text-sm text-slate-400'>Loading nets...</p>
                        </div>
                    </div>
                ) : nets.length === 0 ? (
                    <div className='rounded-2xl border border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-12 text-center shadow-lg shadow-black/20'>
                        <h3 className='text-lg font-medium text-slate-300'>No nets yet</h3>
                        <p className='mt-2 text-sm text-slate-400'>Create your first net to begin tracking check-ins</p>
                    </div>
                ) : (
                    <>
                        <div className='overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm shadow-lg shadow-black/20'>
                            <table className='w-full'>
                                <thead className='border-b border-slate-700/50 bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80'>
                                    <tr>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Date & Time
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Topic
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Status
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Check-ins
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Formal
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Total
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {nets.map((net) => {
                                        const formatDate = (dateString?: string | null) => {
                                            if (!dateString) {
                                                return '--';
                                            }
                                            const date = new Date(dateString);
                                            return date.toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric',
                                                hour: 'numeric',
                                                minute: '2-digit'
                                            });
                                        };

                                        const totalDurationLabel = (() => {
                                            if (net.started_at === null) {
                                                return 'Pending';
                                            }
                                            if (!net.ended_at) {
                                                return 'In Progress';
                                            }
                                            const minutes = getDurationMinutes(
                                                net.started_at,
                                                net.ended_at
                                            );
                                            if (minutes === null) {
                                                return '--';
                                            }
                                            return formatDurationLabel(minutes);
                                        })();

                                        const formalDurationLabel = (() => {
                                            if (net.started_at === null) {
                                                return 'Pending';
                                            }
                                            if (!net.formal_ended_at) {
                                                return net.ended_at ? '--' : 'In Progress';
                                            }
                                            const minutes = getDurationMinutes(
                                                net.started_at,
                                                net.formal_ended_at
                                            );
                                            if (minutes === null) {
                                                return '--';
                                            }
                                            return formatDurationLabel(minutes);
                                        })();

                                        return (
                                            <tr
                                                key={net.id}
                                                onClick={() => { void navigate(`/nets/${net.id}`); }}
                                                className='border-t border-slate-700/30 transition-all duration-200 hover:bg-gradient-to-r hover:from-indigo-500/10 hover:to-purple-500/10 cursor-pointer group'
                                            >
                                                <td className='whitespace-nowrap px-4 py-3 text-sm text-slate-300'>
                                                    {formatDate(net.started_at ?? net.created_at)}
                                                </td>
                                                <td className='px-4 py-3 text-sm text-slate-300'>
                                                    {net.topic ?? <span className='text-slate-500 italic'>No topic</span>}
                                                    {net.shared && (
                                                        <span className='ml-2 inline-flex items-center rounded-full border border-sky-500/30 bg-gradient-to-r from-sky-500/15 to-indigo-500/15 px-2 py-1 text-xs font-medium text-sky-200'>
                                                            Shared
                                                        </span>
                                                    )}
                                                </td>
                                                <td className='whitespace-nowrap px-4 py-3 text-sm'>
                                                    {net.started_at === null ? (
                                                        <span className='inline-flex items-center gap-1 rounded-full border border-slate-600/40 bg-gradient-to-r from-slate-700/30 to-slate-800/30 px-2 py-1 text-xs font-medium text-slate-300'>
                                                            <span className='h-1.5 w-1.5 rounded-full bg-slate-400' />
                                                            Pending
                                                        </span>
                                                    ) : !net.ended_at ? (
                                                        net.formal_ended_at ? (
                                                            <span className='inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-gradient-to-r from-amber-500/15 to-orange-500/15 px-2 py-1 text-xs font-medium text-amber-200'>
                                                                <span className='h-1.5 w-1.5 rounded-full bg-amber-400' />
                                                                Active - Informal
                                                            </span>
                                                        ) : (
                                                            <span className='inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-2 py-1 text-xs font-medium text-emerald-300'>
                                                                <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse' />
                                                                Active - Formal
                                                            </span>
                                                        )
                                                    ) : (
                                                        <span className='text-slate-400'>Ended</span>
                                                    )}
                                                </td>
                                                <td className='whitespace-nowrap px-4 py-3 text-sm font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent'>
                                                    {net.counts.total}
                                                </td>
                                                <td className='whitespace-nowrap px-4 py-3 text-sm text-slate-400'>
                                                    {formalDurationLabel}
                                                </td>
                                                <td className='whitespace-nowrap px-4 py-3 text-sm text-slate-400'>
                                                    {totalDurationLabel}
                                                </td>
                                                <td className='whitespace-nowrap px-4 py-3 text-sm'>
                                                    <div className='flex gap-2'>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                if (net.is_owner) {
                                                                    setNetToDelete(net);
                                                                }
                                                            }}
                                                            className={
                                                                net.is_owner
                                                                    ? 'rounded p-1.5 text-red-400 hover:text-red-300 hover:bg-red-950/30 transition'
                                                                    : 'rounded p-1.5 text-slate-600 opacity-50 cursor-not-allowed'
                                                            }
                                                            title={
                                                                net.is_owner
                                                                    ? 'Delete net'
                                                                    : 'Only the net creator can delete it'
                                                            }
                                                            aria-label={
                                                                net.is_owner
                                                                    ? 'Delete net'
                                                                    : 'Delete net (only the net creator can delete it)'
                                                            }
                                                            aria-disabled={!net.is_owner}
                                                        >
                                                            <FaTrash size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className='mt-4 flex items-center justify-between'>
                            <div className='text-sm text-slate-400'>
                                Showing
                                {' '}
                                {pageStart}
                                {' '}
                                to
                                {' '}
                                {pageEnd}
                                {' '}
                                of
                                {' '}
                                {totalDisplay}
                            </div>
                            <div className='flex gap-2'>
                                <button
                                    onClick={() => { setCurrentPage(p => Math.max(0, p - 1)); }}
                                    disabled={currentPage === 0}
                                    className='rounded-lg border border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2 text-sm text-slate-300 shadow-md shadow-black/20 transition-all duration-200 hover:border-slate-600 hover:from-slate-700 hover:to-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
                                >
                                    Previous
                                </button>
                                <button
                                    onClick={() => { setCurrentPage(p => (hasNextPage ? p + 1 : p)); }}
                                    disabled={!hasNextPage}
                                    className='rounded-lg border border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2 text-sm text-slate-300 shadow-md shadow-black/20 transition-all duration-200 hover:border-slate-600 hover:from-slate-700 hover:to-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Create New Net Modal */}
            <Modal isOpen={isModalOpen} onClose={handleModalClose} title='Create New Net'>
                <form onSubmit={handleModalSubmit}>
                    <div className='mb-6'>
                        <label htmlFor='topic' className='mb-2 block text-sm font-medium text-slate-200'>
                            Topic of the Night
                            <span className='ml-1 text-slate-500'>(optional)</span>
                        </label>
                        <input
                            id='topic'
                            type='text'
                            value={newNetTopic}
                            onChange={(e) => { setNewNetTopic(e.target.value); }}
                            placeholder='e.g., Favorite operating modes'
                            className='w-full rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-slate-100 placeholder-slate-500 transition focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/20'
                            autoFocus
                        />
                        <p className='mt-2 text-xs text-slate-400'>
                            Set a topic for operators to discuss during the net
                        </p>
                    </div>

                    <div
                        className='mb-6 flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-900/60 px-4 py-3'
                        title='When enabled, any of your other nets still marked as in progress will be ended before this new net is created.'
                    >
                        <input
                            id='end-other-nets'
                            type='checkbox'
                            checked={endOtherActiveNets}
                            onChange={(e) => { setEndOtherActiveNets(e.target.checked); }}
                            className='mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0'
                        />
                        <label htmlFor='end-other-nets' className='flex-1 cursor-pointer select-none'>
                            <div className='text-sm font-medium text-slate-200'>
                                End other active nets
                            </div>
                            <p className='mt-1 text-xs text-slate-400'>
                                Automatically closes any of your nets that are still in progress before creating this one.
                            </p>
                        </label>
                    </div>

                    <div
                        className='mb-6 flex items-start gap-3 rounded-lg border border-slate-700/60 bg-slate-900/60 px-4 py-3'
                        title='When enabled, every user can view this net and add check-ins. Only you can run it.'
                    >
                        <input
                            id='shared-net'
                            type='checkbox'
                            checked={sharedNet}
                            onChange={(e) => { setSharedNet(e.target.checked); }}
                            className='mt-1 h-4 w-4 rounded border-slate-700 bg-slate-900 text-sky-500 focus:ring-2 focus:ring-sky-500 focus:ring-offset-0'
                        />
                        <label htmlFor='shared-net' className='flex-1 cursor-pointer select-none'>
                            <div className='text-sm font-medium text-slate-200'>
                                Shared net
                            </div>
                            <p className='mt-1 text-xs text-slate-400'>
                                All users can view this net and contribute check-ins. Leave off to keep it private to you.
                            </p>
                        </label>
                    </div>

                    <div className='flex gap-3'>
                        <button
                            type='submit'
                            disabled={isCreating}
                            className='flex-1 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-50 disabled:cursor-not-allowed'
                        >
                            {isCreating ? 'Creating...' : 'Create Net'}
                        </button>
                        <button
                            type='button'
                            onClick={handleModalClose}
                            className='rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800'
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <Modal
                isOpen={netToDelete !== null}
                onClose={() => { setNetToDelete(null); }}
                title='Delete Net'
            >
                <div className='space-y-4'>
                    <p className='text-sm text-slate-300'>
                        Are you sure you want to delete this net? This will also delete all
                        {' '}
                        <strong>{netToDelete ? netToDelete.counts.total : 0}</strong>
                        {' '}
                        check-ins associated with it.
                    </p>
                    {netToDelete?.topic && (
                        <p className='text-sm text-slate-400'>
                            Topic:
                            {' '}
                            <em>
                                &quot;
                                {netToDelete.topic}
                                &quot;
                            </em>
                        </p>
                    )}
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
                                This action cannot be undone.
                            </div>
                        </div>
                    </div>
                    <div className='flex gap-3'>
                        <button
                            onClick={() => { void handleDeleteNet(); }}
                            disabled={isDeleting}
                            className='flex-1 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            {isDeleting ? 'Deleting...' : 'Delete Net'}
                        </button>
                        <button
                            onClick={() => { setNetToDelete(null); }}
                            disabled={isDeleting}
                            className='flex-1 rounded-lg border border-slate-700 px-4 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};