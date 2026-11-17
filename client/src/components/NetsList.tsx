import { useNavigate } from 'react-router-dom';

import type { NetListItem } from '../api';
import { useAppConfig } from '../contexts/AppConfigContext';

interface NetsListProps {
    nets: NetListItem[];
    onResumeNet?: (netId: number) => void;
}

export const NetsList = ({ nets, onResumeNet }: NetsListProps) => {
    const navigate = useNavigate();
    const { mobilityEnabled } = useAppConfig();

    const formatDate = (dateString: string | null) => {
        if (!dateString) {
            return '--';
        }
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
    };

    const formatDuration = (startedAt: string | null, endedAt: string | null) => {
        if (!startedAt)
            return 'Pending';
        if (!endedAt)
            return 'In Progress';
        const start = new Date(startedAt);
        const end = new Date(endedAt);
        const durationMs = end.getTime() - start.getTime();
        const hours = Math.floor(durationMs / (1000 * 60 * 60));
        const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        return `${minutes}m`;
    };

    const handleNetClick = (net: NetListItem) => {
        if (net.started_at !== null && net.ended_at === null && onResumeNet) {
            onResumeNet(net.id);
            return;
        }
        void navigate(`/nets/${net.id}`);
    };

    if (nets.length === 0) {
        return (
            <div className='rounded-2xl border border-slate-800/70 bg-slate-900/70 p-12 text-center'>
                <svg
                    className='mx-auto h-12 w-12 text-slate-600'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                    xmlns='http://www.w3.org/2000/svg'
                >
                    <path
                        strokeLinecap='round'
                        strokeLinejoin='round'
                        strokeWidth={2}
                        d='M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0'
                    />
                </svg>
                <h3 className='mt-4 text-lg font-medium text-slate-300'>No nets yet</h3>
                <p className='mt-2 text-sm text-slate-400'>Start your first net to begin tracking check-ins</p>
            </div>
        );
    }

    return (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {nets.map(net => (
                <button
                    key={net.id}
                    onClick={() => { handleNetClick(net); }}
                    className='group rounded-2xl border border-slate-800/70 bg-slate-900/70 p-5 text-left transition hover:border-sky-500/40 hover:bg-slate-900/90'
                >
                    <div className='mb-3 flex items-start justify-between'>
                        <div className='flex-1'>
                            <div className='text-sm text-slate-400'>{formatDate(net.started_at ?? net.created_at)}</div>
                            {net.topic && (
                                <div className='mt-1 text-sm font-medium text-slate-200'>
                                    &quot;
                                    {net.topic}
                                    &quot;
                                </div>
                            )}
                        </div>
                        {net.started_at === null ? (
                            <span className='inline-flex items-center gap-1 rounded-full bg-slate-700/50 px-2 py-1 text-xs font-medium text-slate-200'>
                                <span className='h-1.5 w-1.5 rounded-full bg-slate-400' />
                                Pending
                            </span>
                        ) : !net.ended_at ? (
                            <span className='inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300'>
                                <span className='h-1.5 w-1.5 rounded-full bg-emerald-400' />
                                Active
                            </span>
                        ) : (
                            <span className='text-xs text-slate-500'>{formatDuration(net.started_at, net.ended_at)}</span>
                        )}
                    </div>

                    <div className='grid grid-cols-2 gap-2 border-t border-slate-800/50 pt-3'>
                        <div>
                            <div className='text-2xl font-semibold text-sky-400'>{net.counts.total}</div>
                            <div className='text-xs text-slate-400'>Total Check-ins</div>
                        </div>
                        <div>
                            <div className='text-2xl font-semibold text-slate-300'>{net.counts.staying}</div>
                            <div className='text-xs text-slate-400'>Staying</div>
                        </div>
                        {mobilityEnabled && (net.counts.mobile > 0 || net.counts.portable > 0) && (
                            <>
                                <div>
                                    <div className='text-lg font-semibold text-slate-300'>{net.counts.mobile}</div>
                                    <div className='text-xs text-slate-400'>Mobile</div>
                                </div>
                                <div>
                                    <div className='text-lg font-semibold text-slate-300'>{net.counts.portable}</div>
                                    <div className='text-xs text-slate-400'>Portable</div>
                                </div>
                            </>
                        )}
                    </div>

                    <div className='mt-3 flex items-center gap-2 text-sm text-sky-400 opacity-0 transition group-hover:opacity-100'>
                        {!net.ended_at && net.started_at !== null ? 'Resume Net' : 'View Net'}
                        <svg className='h-4 w-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M9 5l7 7-7 7' />
                        </svg>
                    </div>
                </button>
            ))}
        </div>
    );
};