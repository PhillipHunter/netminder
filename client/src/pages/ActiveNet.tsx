import {
    useEffect,
    useState
} from 'react';
import {
    FaCar,
    FaDownload,
    FaPause,
    FaPlay,
    FaStop,
    FaSuitcase
} from 'react-icons/fa';
import { useParams } from 'react-router-dom';

import type {
    Checkin,
    MobilityType,
    Net
} from '../api';
import {
    createCheckin,
    endNet,
    endNetFormal,
    fetchCheckins,
    fetchNet,
    restartNet,
    resumeNetFormal,
    startNet,
    updateNet
} from '../api';
import { CallsignInput } from '../components/CallsignInput';
import { CheckinRow } from '../components/CheckinRow';
import { EditableText } from '../components/EditableName';
import { PageHeader } from '../components/PageHeader';
import { StationHistoryPanel } from '../components/StationHistoryPanel';
import { StickyOnScroll } from '../components/StickyOnScroll';
import { useAppConfig } from '../contexts/AppConfigContext';
import {
    formatDurationLabel,
    getDurationMinutes
} from '../utils/duration';
import { resolveErrorMessage } from '../utils/errors';

function getLiveClockParts(date: Date): { hours: string; minutes: string; period: string } {
    const localeTime = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
    const [time = '', period = ''] = localeTime.split(' ');
    const [hours = '', minutes = ''] = time.split(':');
    return { hours, minutes, period };
}

export function ActiveNet() {
    const { id } = useParams<{ id: string }>();
    const { mobilityEnabled } = useAppConfig();

    const [net, setNet] = useState<Net | null>(null);
    const [checkins, setCheckins] = useState<Checkin[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // History panel
    const [historyPanelOpen, setHistoryPanelOpen] = useState(false);
    const [historyCallsign, setHistoryCallsign] = useState('');

    // Recent checkin meta for badges
    const [checkinMeta, setCheckinMeta] = useState<
        Map<number, { isNew: boolean; priorCheckins: number }>
    >(new Map());
    const [selectedCheckinId, setSelectedCheckinId] = useState<number | null>(null);

    const [currentTime, setCurrentTime] = useState<Date>(() => new Date());
    const [showColon, setShowColon] = useState(true);

    // Fetch net details
    useEffect(() => {
        if (!id)
            return;

        async function loadNet() {
            try {
                setIsLoading(true);
                const netId = Number(id);
                if (Number.isNaN(netId)) {
                    setError('Invalid net identifier');
                    setIsLoading(false);
                    return;
                }

                const details = await fetchNet(netId);
                setNet(details);
            } catch (err) {
                console.error('Error fetching net:', err);
                setError('Failed to load net details');
            } finally {
                setIsLoading(false);
            }
        }

        void loadNet();
    }, [id]);

    // Fetch checkins
    useEffect(() => {
        if (!id)
            return;

        async function loadCheckins() {
            try {
                const netId = Number(id);
                if (Number.isNaN(netId))
                    return;
                const response = await fetchCheckins(netId);
                const sorted = [...response].sort((a, b) => new Date(a.time_entered).getTime() - new Date(b.time_entered).getTime());
                setCheckins(sorted);
            } catch (err) {
                console.error('Error fetching checkins:', err);
            }
        }

        void loadCheckins();

        // Poll for updates every 10 seconds
        const interval = setInterval(() => void loadCheckins(), 10000);
        return () => { clearInterval(interval); };
    }, [id]);

    // Calculate summary counts
    const counts = {
        total: checkins.length,
        staying: checkins.filter(c => c.staying).length,
        inAndOut: checkins.filter(c => !c.staying).length,
        mobile: checkins.filter(c => c.mobility === 'mobile').length,
        portable: checkins.filter(c => c.mobility === 'portable').length
    };

    useEffect(() => {
        setCurrentTime(new Date());

        const interval = setInterval(() => {
            setCurrentTime(new Date());
            setShowColon(prev => !prev);
        }, 1000);

        return () => { clearInterval(interval); };
    }, []);

    const liveClockParts = getLiveClockParts(currentTime);

    const formatStartTime = (timestamp: string | null | undefined) => {
        if (!timestamp) {
            return '--';
        }
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const startedAt = net?.started_at ?? null;
    const endedAt = net?.ended_at ?? null;

    const formalDurationMinutes = (() => {
        if (!net?.formal_ended_at || !startedAt) {
            return null;
        }
        return getDurationMinutes(startedAt, net.formal_ended_at);
    })();

    const totalDurationMinutes = (() => {
        if (!endedAt || !startedAt) {
            return null;
        }
        return getDurationMinutes(startedAt, endedAt);
    })();

    const showCurrentTime = Boolean(startedAt && !endedAt);

    const netTimingStats = net
        ? [
            {
                key: startedAt ? 'started' : 'created',
                label: startedAt ? 'Net Started' : 'Net Created',
                value: formatStartTime(startedAt ?? net.created_at)
            },
            startedAt && endedAt
                ? {
                    key: 'ended',
                    label: 'Net Ended',
                    value: formatStartTime(endedAt)
                }
                : null,
            startedAt && formalDurationMinutes !== null
                ? {
                    key: 'formal-duration',
                    label: 'Formal Time',
                    value: formatDurationLabel(formalDurationMinutes)
                }
                : null,
            startedAt && totalDurationMinutes !== null
                ? {
                    key: 'total-duration',
                    label: 'Net Total Time',
                    value: formatDurationLabel(totalDurationMinutes)
                }
                : null
        ].filter((stat): stat is { key: string; label: string; value: string } => stat !== null)
        : [];

    const isPendingNet = startedAt === null;
    const checkinsDisabled = startedAt === null || endedAt !== null;

    const handleCheckinSubmit = async ({
        callsign,
        mobility,
        staying,
        topicAnswer,
        preferredName,
        location
    }: {
        callsign: string;
        mobility: MobilityType;
        staying: boolean;
        topicAnswer?: string;
        preferredName?: string;
        location?: string;
    }) => {
        if (!id)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                return;

            const trimmedTopic = topicAnswer?.trim() ?? '';
            const trimmedPreferredName = preferredName?.trim() ?? '';
            const trimmedLocation = location?.trim() ?? '';

            const response = await createCheckin(netId, {
                callsign,
                mobility,
                staying,
                topic_answer: trimmedTopic.length > 0 ? trimmedTopic : undefined,
                preferred_name: trimmedPreferredName.length > 0 ? trimmedPreferredName : undefined,
                location: trimmedLocation.length > 0 ? trimmedLocation : undefined
            });

            setCheckins((prev) => {
                const exists = prev.some(checkin => checkin.id === response.checkin.id);
                if (exists) {
                    return prev.map(checkin => (checkin.id === response.checkin.id ? response.checkin : checkin));
                }
                const next = [...prev, response.checkin];
                return next.sort((a, b) => new Date(a.time_entered).getTime() - new Date(b.time_entered).getTime());
            });

            setCheckinMeta((prev) => {
                const map = new Map(prev);
                map.set(response.checkin.id, {
                    isNew: response.meta.is_new,
                    priorCheckins: response.meta.prior_checkins
                });
                return map;
            });
        } catch (err: unknown) {
            console.error('Error creating checkin:', err);
            const errorMessage = resolveErrorMessage(err, 'Failed to create check-in');
            alert(errorMessage);
            throw err;
        }
    };

    const handleCheckinUpdate = (updatedCheckin: Checkin) => {
        setCheckins(prev => prev.map(c => (c.id === updatedCheckin.id ? updatedCheckin : c)));
    };

    const handleCheckinDelete = (checkinId: number) => {
        setCheckins(prev => prev.filter(c => c.id !== checkinId));
        setCheckinMeta((prev) => {
            const next = new Map(prev);
            next.delete(checkinId);
            return next;
        });
    };

    const handleCheckinCallsignRenamed = (previousCallsign: string, updatedCallsign: string) => {
        if (
            historyPanelOpen
            && historyCallsign.trim().toUpperCase() === previousCallsign.toUpperCase()
        ) {
            setHistoryCallsign(updatedCallsign);
        }
    };

    const handleStationPanelUpdated = async (updatedCallsign?: string) => {
        const targetCallsign = updatedCallsign ?? historyCallsign;
        if (!targetCallsign)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                return;

            const refreshed = await fetchCheckins(netId);
            const sorted = [...refreshed].sort((a, b) => new Date(a.time_entered).getTime() - new Date(b.time_entered).getTime());
            setCheckins(sorted);
        } catch (err) {
            console.error('Error refreshing station details after update:', err);
        }
    };

    useEffect(() => {
        if (selectedCheckinId !== null && !checkins.some(checkin => checkin.id === selectedCheckinId)) {
            setSelectedCheckinId(null);
        }
    }, [checkins, selectedCheckinId]);

    const handleNetTopicSave = async (nextValue: string) => {
        if (!id)
            throw new Error('Net identifier is missing');

        const trimmedValue = nextValue.trim();
        const normalizedTopic = trimmedValue.length > 0 ? trimmedValue : null;
        const currentTopic = net?.topic ?? null;

        if (normalizedTopic === currentTopic)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                throw new Error('Invalid net identifier');

            const updated = await updateNet(netId, { topic: normalizedTopic ?? null });
            setNet(updated);
        } catch (err) {
            console.error('Error updating topic:', err);
            throw err instanceof Error ? err : new Error(resolveErrorMessage(err, 'Failed to update topic'));
        }
    };

    const handleExportCSV = () => {
        if (checkins.length === 0) {
            alert('No check-ins to export');
            return;
        }

        // Build CSV content
        const headers = [
            'Time',
            'Callsign',
            'Name',
            ...(mobilityEnabled ? ['Mobility'] : []),
            'Staying',
            'Topic Answer',
            'Called Back'
        ];

        const rows = checkins.map(c => [
            new Date(c.time_entered).toLocaleString(),
            c.callsign,
            c.display_name ?? '',
            ...(mobilityEnabled ? [c.mobility] : []),
            c.staying ? 'Yes' : 'No',
            c.topic_answer ?? '',
            c.called_back ? 'Yes' : 'No'
        ]);

        const csv = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        // Download
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `net-${id}-checkins-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleEndNet = async () => {
        if (!id)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                return;

            const updated = await endNet(netId);
            setNet(updated);
        } catch (err) {
            console.error('Error ending net:', err);
            alert(resolveErrorMessage(err, 'Failed to end net'));
        }
    };

    const handleEndFormal = async () => {
        if (!id)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                return;

            const updated = await endNetFormal(netId);
            setNet(updated);
        } catch (err) {
            console.error('Error ending formal portion of net:', err);
            alert(resolveErrorMessage(err, 'Failed to end formal portion of the net'));
        }
    };

    const handleResumeFormal = async () => {
        if (!id)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                return;

            const updated = await resumeNetFormal(netId);
            setNet(updated);
        } catch (err) {
            console.error('Error resuming formal portion of net:', err);
            alert(resolveErrorMessage(err, 'Failed to resume formal portion of the net'));
        }
    };

    const handleStartPendingNet = async () => {
        if (!id)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                return;

            const updated = await startNet(netId);
            setNet(updated);
        } catch (err) {
            console.error('Error starting net:', err);
            alert(resolveErrorMessage(err, 'Failed to start net'));
        }
    };

    const handleRestartNet = async () => {
        if (!id)
            return;

        try {
            const netId = Number(id);
            if (Number.isNaN(netId))
                return;

            const updated = await restartNet(netId);
            setNet(updated);
        } catch (err) {
            console.error('Error restarting net:', err);
            alert(resolveErrorMessage(err, 'Failed to restart net'));
        }
    };

    const handleRowSelect = (checkinId: number) => {
        setSelectedCheckinId(prev => (prev === checkinId ? null : checkinId));
    };

    if (isLoading) {
        return (
            <div className='flex min-h-screen items-center justify-center'>
                <svg
                    className='h-12 w-12 animate-spin text-indigo-400'
                    xmlns='http://www.w3.org/2000/svg'
                    fill='none'
                    viewBox='0 0 24 24'
                >
                    <circle
                        className='opacity-25'
                        cx='12'
                        cy='12'
                        r='10'
                        stroke='currentColor'
                        strokeWidth='4'
                    >
                    </circle>
                    <path
                        className='opacity-75'
                        fill='currentColor'
                        d='M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z'
                    >
                    </path>
                </svg>
            </div>
        );
    }

    if (error || !net) {
        return (
            <div className='flex min-h-screen items-center justify-center'>
                <div className='rounded-lg border border-red-500/30 bg-red-500/10 p-6 text-red-400'>
                    {error ?? 'Net not found'}
                </div>
            </div>
        );
    }

    return (
        <div className='min-h-screen'>
            <PageHeader />

            <main className='mx-auto px-6 py-8'>
                {/* Net header with start time and topic */}
                <div className='mb-6 rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-6 shadow-lg shadow-black/20'>
                    <div className='flex items-start justify-between'>
                        <div>
                            <div className='flex flex-wrap items-start gap-6'>
                                {showCurrentTime && (
                                    <div className='flex flex-col gap-1'>
                                        <span className='text-sm text-slate-400'>
                                            Current Time
                                        </span>
                                        <div className='mt-1 flex items-baseline text-2xl font-semibold leading-none text-slate-100'>
                                            {[
                                                <span key='hours'>{liveClockParts.hours}</span>,
                                                <span
                                                    key='colon'
                                                    className={`inline-block transition-opacity duration-150 ${showColon ? 'opacity-100' : 'opacity-0'}`}
                                                >
                                                    :
                                                </span>,
                                                <span key='minutes'>{liveClockParts.minutes}</span>
                                            ]}
                                            <span className='ml-1 text-sm font-normal text-slate-400 align-baseline'>
                                                {liveClockParts.period}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                {netTimingStats.map((stat, index) => (
                                    <div
                                        key={stat.key}
                                        className={`flex flex-col ${(index > 0 || showCurrentTime) ? 'border-l border-slate-700/60 pl-6' : ''}`}
                                    >
                                        <div className='text-sm text-slate-400'>
                                            {stat.label}
                                        </div>
                                        <div className='mt-1 text-xl font-semibold text-slate-100'>
                                            {stat.value}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Summary chips */}
                        <div className='flex flex-wrap gap-2'>
                            <div className='rounded-full border border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2 shadow-md shadow-black/20 text-center'>
                                <div className='text-xs text-slate-400'>Total</div>
                                <div className='text-lg font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent'>
                                    {counts.total}
                                </div>
                            </div>
                            <div className='rounded-full border border-emerald-500/50 bg-gradient-to-br from-emerald-950/40 to-teal-950/40 px-4 py-2 shadow-md shadow-emerald-500/10 text-center'>
                                <div className='text-xs text-emerald-400'>Staying</div>
                                <div className='text-lg font-bold text-emerald-300'>
                                    {counts.staying}
                                </div>
                            </div>
                            <div className='rounded-full border border-orange-500/50 bg-gradient-to-br from-orange-950/40 to-red-950/40 px-4 py-2 shadow-md shadow-orange-500/10 text-center'>
                                <div className='text-xs text-orange-400'>In & Out</div>
                                <div className='text-lg font-bold text-orange-300'>
                                    {counts.inAndOut}
                                </div>
                            </div>
                            {mobilityEnabled && (
                                <>
                                    <div className='flex items-center gap-2 rounded-full border border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2 shadow-md shadow-black/20'>
                                        <FaCar className='text-indigo-400' />
                                        <div className='text-lg font-bold text-slate-100'>
                                            {counts.mobile}
                                        </div>
                                    </div>
                                    <div className='flex items-center gap-2 rounded-full border border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2 shadow-md shadow-black/20'>
                                        <FaSuitcase className='text-indigo-400' />
                                        <div className='text-lg font-bold text-slate-100'>
                                            {counts.portable}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <div className='mt-6 flex flex-wrap items-start justify-between gap-4'>
                        <div className='min-w-[240px] flex-1'>
                            <div className='text-sm font-medium text-slate-400'>Topic</div>
                            <EditableText
                                value={net.topic ?? null}
                                onSave={handleNetTopicSave}
                                placeholder='Click to add topic'
                                className='mt-1'
                                textClassName='w-full text-left text-base text-slate-300 hover:text-slate-100'
                                inputProps={{ className: 'text-base' }}
                            />
                        </div>
                        <div className='mt-4 flex w-full flex-wrap justify-end gap-3 sm:mt-0 sm:w-auto'>
                            {isPendingNet ? (
                                <button
                                    onClick={() => { void handleStartPendingNet(); }}
                                    className='flex items-center gap-2 rounded-lg border border-sky-500/50 bg-gradient-to-r from-sky-500/20 to-cyan-500/10 px-4 py-2 text-sm font-semibold text-sky-200 shadow-md shadow-sky-500/10 transition-all duration-200 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/20'
                                >
                                    <FaPlay size={12} />
                                    Start Net
                                </button>
                            ) : net.ended_at ? (
                                <button
                                    onClick={() => { void handleRestartNet(); }}
                                    className='flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-gradient-to-r from-emerald-950/40 to-teal-950/40 px-4 py-2 text-sm font-semibold text-emerald-300 shadow-md shadow-emerald-500/10 transition-all duration-200 hover:border-emerald-400 hover:shadow-lg hover:shadow-emerald-500/20'
                                >
                                    <FaPlay size={12} />
                                    Restart Net
                                </button>
                            ) : (
                                <>
                                    {net.formal_ended_at ? (
                                        <button
                                            onClick={() => { void handleResumeFormal(); }}
                                            className='flex items-center gap-2 rounded-lg border border-sky-500/50 bg-gradient-to-r from-sky-950/40 to-cyan-950/40 px-4 py-2 text-sm font-semibold text-sky-300 shadow-md shadow-sky-500/10 transition-all duration-200 hover:border-sky-400 hover:shadow-lg hover:shadow-sky-500/20'
                                        >
                                            <FaPlay size={12} />
                                            Resume Formal
                                        </button>
                                    ) : (
                                        <button
                                            onClick={() => { void handleEndFormal(); }}
                                            className='flex items-center gap-2 rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-950/40 to-yellow-950/40 px-4 py-2 text-sm font-semibold text-amber-200 shadow-md shadow-amber-500/10 transition-all duration-200 hover:border-amber-400 hover:shadow-lg hover:shadow-amber-500/20'
                                        >
                                            <FaPause size={12} />
                                            End Formal
                                        </button>
                                    )}
                                    <button
                                        onClick={() => { void handleEndNet(); }}
                                        className='flex items-center gap-2 rounded-lg border border-red-500/50 bg-gradient-to-r from-red-950/40 to-orange-950/40 px-4 py-2 text-sm font-semibold text-red-300 shadow-md shadow-red-500/10 transition-all duration-200 hover:border-red-400 hover:shadow-lg hover:shadow-red-500/20'
                                    >
                                        <FaStop size={12} />
                                        End Net
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Callsign input */}
                <StickyOnScroll
                    className='mb-6'
                    contentClassName='w-full rounded-xl border border-slate-700/60 bg-gradient-to-b from-slate-900/80 to-slate-950/80 backdrop-blur-sm px-5 py-4 shadow-md shadow-black/20'
                    stuckClassName='border-sky-500/40 shadow-lg shadow-black/35'
                    top={0}
                    zIndex={40}
                >
                    {checkinsDisabled && (
                        <p className='mb-3 text-sm text-slate-400'>
                            {isPendingNet
                                ? 'Start the net to begin accepting check-ins.'
                                : 'This net has ended. Restart the net to log additional activity.'}
                        </p>
                    )}
                    <CallsignInput
                        onSubmit={handleCheckinSubmit}
                        autoFocus={!checkinsDisabled}
                        disabled={checkinsDisabled}
                    />
                </StickyOnScroll>

                {/* Actions bar */}
                <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                    <h2 className='text-lg font-semibold text-slate-100'>
                        Check-ins (
                        {checkins.length}
                        )
                    </h2>
                    <button
                        onClick={handleExportCSV}
                        className='flex items-center gap-2 rounded-lg border border-slate-700/70 bg-gradient-to-b from-slate-800 to-slate-900 px-4 py-2 text-sm text-slate-300 shadow-md shadow-black/20 transition-all duration-200 hover:border-slate-600 hover:from-slate-700 hover:to-slate-800'
                    >
                        <FaDownload />
                        Export CSV
                    </button>
                </div>

                {/* Check-ins table */}
                <div className='overflow-hidden rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-800/50 to-slate-900/50 backdrop-blur-sm shadow-lg shadow-black/20'>
                    {checkins.length === 0 ? (
                        <div className='p-12 text-center text-slate-400'>
                            No check-ins yet. Enter a callsign above to get started.
                        </div>
                    ) : (
                        <div className='overflow-x-auto'>
                            <table className='w-full'>
                                <thead className='border-b border-slate-700/50 bg-gradient-to-r from-slate-900/80 via-slate-800/80 to-slate-900/80'>
                                    <tr>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            #
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Time
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Callsign
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Name
                                        </th>
                                        {mobilityEnabled && (
                                            <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                                Mobility
                                            </th>
                                        )}
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Status
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Topic Answer
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Called Back
                                        </th>
                                        <th className='px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400'>
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {checkins.map((checkin, index) => {
                                        const meta = checkinMeta.get(checkin.id);
                                        const isActiveRow = historyPanelOpen
                                            && historyCallsign.trim().toUpperCase() === checkin.callsign.trim().toUpperCase();
                                        return (
                                            <CheckinRow
                                                key={checkin.id}
                                                checkin={checkin}
                                                orderNumber={index + 1}
                                                isNew={meta?.isNew}
                                                isReturning={
                                                    !meta?.isNew && (meta?.priorCheckins ?? 0) > 0
                                                }
                                                onUpdate={handleCheckinUpdate}
                                                onDelete={handleCheckinDelete}
                                                onCallsignClick={(callsign) => {
                                                    setHistoryCallsign(callsign);
                                                    setHistoryPanelOpen(true);
                                                }}
                                                onCallsignRenamed={handleCheckinCallsignRenamed}
                                                isActive={isActiveRow}
                                                onSelect={handleRowSelect}
                                                isSelected={selectedCheckinId === checkin.id}
                                            />
                                        );
                                    })}
                                </tbody>
                                <tfoot className='border-t border-slate-800/70 bg-slate-900/60'>
                                    <tr>
                                        <td
                                            className='px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-400'
                                            colSpan={mobilityEnabled ? 9 : 8}
                                        >
                                            Total Check-Ins:
                                            {' '}
                                            {counts.total}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </main>

            {/* Station history panel */}
            <StationHistoryPanel
                callsign={historyCallsign}
                isOpen={historyPanelOpen}
                onClose={() => { setHistoryPanelOpen(false); }}
                onCallsignRenamed={(previousCallsign, newCallsign) => {
                    setCheckins(prev => prev.map(checkin => (checkin.callsign === previousCallsign
                        ? { ...checkin, callsign: newCallsign }
                        : checkin)));
                    setHistoryCallsign(newCallsign);
                }}
                onStationUpdated={handleStationPanelUpdated}
            />
        </div>
    );
}