import { edenTreaty } from '@elysiajs/eden';

import type {
    App,
    account,
    auth,
    checkins,
    config,
    health,
    nets,
    settings,
    stations,
    users
} from '@netminder/api';

import {
    normalizeErrorMessage,
    resolveErrorMessage
} from './utils/errors';

const origin = typeof window !== 'undefined' ? window.location.origin : '';
const backend = edenTreaty<App>(origin, { $fetch: { credentials: 'include' } });

export type User = users.UserSchema;
export type AuthResponse = auth.LoginResponse;
export type CreateUserPayload = users.CreateBody;
export type UpdateUserPayload = users.UpdateBody;
export type UserWithNetCount = users.ListResponse['users'][number];
export type Net = nets.GetResponse['net'];
export type NetListItem = nets.ListResponse['nets'][number];
export type Checkin = checkins.CheckinSchema;
export type CheckinMeta = checkins.CheckinMetaSchema;
export type CreateCheckinRequest = checkins.CreateBody;
export type UpdateCheckinPayload = checkins.UpdateBody;
export type MobilityType = checkins.MobilitySchema;
export type Station = stations.StationDetailSchema;
export type StationListItem = stations.ListResponse['stations'][number];
export type StationStats = stations.StationStatsSchema;
export type StationLookupResponse = stations.LookupResponse['lookup'];
export type StationFieldSource = stations.StationLookupFieldSchema['source'];
export type QrzSettingsStatus = settings.QRZStatusSchema;
export type AppConfig = config.ClientConfigSchema;
export type AppSettingsConfig = config.AppConfigSchema;
export type MapSettings = settings.GetMapResponse['map'];
export type QrzCredentialMode = settings.QRZModeSchema;
export type AccountQrzStatus = account.AccountQrzStatusSchema;
export type AccountQrzTestResult = account.TestResponse;

interface EdenErrorPayload {
    error: {
        code: string;
        message: string;
    };
}

interface EdenSuccess<TData, TResponse = unknown> {
    data: TData | EdenErrorPayload | null;
    error: null;
    status: number;
    response: TResponse;
    headers: Record<string, string>;
}

interface EdenFailure<TResponse = unknown> {
    data: null;
    error: unknown;
    status: number;
    response: TResponse;
    headers: Record<string, string>;
}

type EdenResult<TData, TResponse = unknown> = EdenSuccess<TData, TResponse> | EdenFailure<TResponse>;

function isEdenErrorPayload(value: unknown): value is EdenErrorPayload {
    if (typeof value !== 'object' || value === null) {
        return false;
    }

    const candidate = value as { error?: unknown };
    if (typeof candidate.error !== 'object' || candidate.error === null) {
        return false;
    }

    const error = candidate.error as { code?: unknown; message?: unknown };
    return typeof error.code === 'string' && typeof error.message === 'string';
}

export class ApiError extends Error {
    readonly status: number;
    readonly code: string | null;

    constructor(message: string, status: number, code: string | null) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.code = code;
    }
}

export function isNotFoundError(error: unknown): boolean {
    return error instanceof ApiError && (error.status === 404 || error.code === 'NET_NOT_FOUND');
}

async function extractResponseError(response: unknown, fallback: string): Promise<string> {
    if (!(response instanceof Response)) {
        return fallback;
    }

    try {
        const clone = response.bodyUsed ? null : response.clone();
        if (!clone) {
            return fallback;
        }

        const contentType = clone.headers.get('content-type') ?? '';

        if (contentType.includes('application/json')) {
            const body: unknown = await clone.json();
            const message = resolveErrorMessage(body, fallback);
            if (message && message !== fallback) {
                return message;
            }
        } else {
            const text = await clone.text();
            const normalized = normalizeErrorMessage(text);
            if (normalized) {
                return normalized;
            }
        }
    } catch (error) {
        console.error('Failed to parse error response payload', error);
    }

    return fallback;
}

async function unwrapResponse<TData = unknown, TResponse = unknown>(
    promise: Promise<EdenResult<TData, TResponse>>,
    fallback: string
): Promise<TData> {
    const result = await promise;

    if (result.error !== null) {
        const fallbackMessage = resolveErrorMessage(result.error, fallback);

        let responseMessage = fallbackMessage;

        const candidateResponse = (result as { response?: unknown }).response;
        const responseResolved = await extractResponseError(candidateResponse, fallbackMessage);
        if (responseResolved !== fallbackMessage) {
            responseMessage = responseResolved;
        } else {
            const errorResponseResolved = await extractResponseError(result.error, fallbackMessage);
            if (errorResponseResolved !== fallbackMessage) {
                responseMessage = errorResponseResolved;
            }
        }

        const errorValue = (result.error as { value?: unknown } | null)?.value;
        const code = isEdenErrorPayload(errorValue) ? errorValue.error.code : null;
        throw new ApiError(responseMessage, result.status, code);
    }

    const data = result.data;

    if (data === null) {
        throw new Error(fallback);
    }

    if (isEdenErrorPayload(data)) {
        throw new Error(resolveErrorMessage(data, fallback));
    }

    return data as TData;
}

export interface SetupStatus {
    needsSetup: boolean;
    userCount: number;
}

export async function fetchSetupStatus(): Promise<SetupStatus> {
    const data = await unwrapResponse<auth.SetupCheckResponse>(
        backend.api.auth['setup-check'].get(),
        'Failed to check setup status'
    );
    return {
        needsSetup: data.needs_setup,
        userCount: data.user_count
    };
}

export async function registerInitialUser(payload: { username: string; password: string }): Promise<User> {
    const data = await unwrapResponse<auth.RegisterInitialResponse>(
        backend.api.auth['register-initial'].post(payload),
        'Failed to create initial admin user'
    );
    return data.user;
}

export async function loginUser(username: string, password: string): Promise<AuthResponse> {
    const data = await unwrapResponse<auth.LoginResponse>(
        backend.api.auth.login.post({ username, password }),
        'Failed to login'
    );
    return data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<auth.ChangePasswordResponse['user']> {
    const data = await unwrapResponse<auth.ChangePasswordResponse>(
        backend.api.auth['change-password'].post({ current_password: currentPassword, new_password: newPassword }),
        'Failed to change password'
    );
    return data.user;
}

export async function logoutUser(): Promise<void> {
    await unwrapResponse(backend.api.auth.logout.post(), 'Failed to logout');
}

export async function fetchCurrentUser(): Promise<User> {
    const data = await unwrapResponse<auth.MeResponse>(
        backend.api.auth.me.get(),
        'Failed to fetch current user'
    );
    return data.user;
}

export async function fetchHealth(): Promise<health.HealthResponse> {
    return unwrapResponse<health.HealthResponse>(backend.api.health.get(), 'Failed to fetch health status');
}

export async function fetchNets(limit = 5, offset = 0): Promise<nets.ListResponse> {
    const params: nets.ListRequest = {
        limit,
        offset
    };
    return unwrapResponse<nets.ListResponse>(backend.api.nets.get({ $query: params }), 'Failed to fetch nets');
}

export async function fetchStations(
    params: Partial<stations.ListRequest> = {}
): Promise<stations.ListResponse> {
    const query: stations.ListRequest = { ...params } as stations.ListRequest;
    return unwrapResponse<stations.ListResponse>(backend.api.stations.get({ $query: query }), 'Failed to fetch stations');
}

export async function fetchStationLookup(callsign: string): Promise<StationLookupResponse> {
    const normalized = normalizeCallsignInput(callsign);
    const data = await unwrapResponse<stations.LookupResponse>(
        backend.api.stations.lookup[normalized].get(),
        'Failed to lookup station'
    );
    return data.lookup;
}

export async function fetchStationDetail(callsign: string): Promise<Station | null> {
    const normalized = normalizeCallsignInput(callsign);
    const data = await unwrapResponse<stations.GetResponse>(
        backend.api.stations[normalized].get(),
        'Failed to fetch station'
    );
    return data.station;
}

export async function updateStation(
    callsign: string,
    payload: stations.UpdateBody
): Promise<Station> {
    const normalized = normalizeCallsignInput(callsign);
    const data = await unwrapResponse<stations.UpdateResponse>(
        backend.api.stations[normalized].put(payload),
        'Failed to update station'
    );
    return data.station;
}

export async function refreshStation(callsign: string): Promise<Station> {
    const normalized = normalizeCallsignInput(callsign);
    const data = await unwrapResponse<stations.RefreshResponse>(
        backend.api.stations[normalized]['refresh-qrz'].post(),
        'Failed to refresh station'
    );
    return data.station;
}

export async function deleteStation(callsign: string): Promise<void> {
    const normalized = normalizeCallsignInput(callsign);
    await unwrapResponse(backend.api.stations[normalized].delete(), 'Failed to delete station');
}

export async function fetchStationStats(callsign: string): Promise<StationStats> {
    const normalized = normalizeCallsignInput(callsign);
    const data = await unwrapResponse<stations.StatsResponse>(
        backend.api.stations[normalized].stats.get(),
        'Failed to fetch station stats'
    );
    return data.stats;
}

export async function fetchQrzSettings(): Promise<QrzSettingsStatus> {
    const data = await unwrapResponse<settings.GetResponse>(backend.api.settings.qrz.get(), 'Failed to load QRZ settings');
    return data.settings;
}

export async function updateQrzSettings(payload: settings.UpdateBody): Promise<QrzSettingsStatus> {
    const data = await unwrapResponse<settings.UpdateResponse>(backend.api.settings.qrz.put(payload), 'Failed to update QRZ settings');
    return data.settings;
}

export async function deleteQrzSettings(): Promise<void> {
    await unwrapResponse(backend.api.settings.qrz.delete(), 'Failed to remove QRZ credentials');
}

export async function updateQrzMode(mode: QrzCredentialMode): Promise<QrzCredentialMode> {
    const data = await unwrapResponse<settings.UpdateModeResponse>(backend.api.settings.qrz.mode.put({ mode }), 'Failed to update QRZ credential mode');
    return data.mode;
}

export async function fetchAccountQrz(): Promise<AccountQrzStatus> {
    const data = await unwrapResponse<account.GetResponse>(backend.api.account.qrz.get(), 'Failed to load your QRZ settings');
    return data.settings;
}

export async function updateAccountQrz(payload: account.UpdateBody): Promise<AccountQrzStatus> {
    const data = await unwrapResponse<account.UpdateResponse>(backend.api.account.qrz.put(payload), 'Failed to update your QRZ credentials');
    return data.settings;
}

export async function testAccountQrz(): Promise<AccountQrzTestResult> {
    return unwrapResponse<account.TestResponse>(backend.api.account.qrz.test.post(), 'Failed to test your QRZ credentials');
}

export async function deleteAccountQrz(): Promise<void> {
    await unwrapResponse(backend.api.account.qrz.delete(), 'Failed to remove your QRZ credentials');
}

export async function fetchAppConfig(): Promise<AppConfig> {
    const data = await unwrapResponse<config.GetResponse>(backend.api.config.get(), 'Failed to load app configuration');
    return data.config;
}

export type GeocodingStatus = settings.GetAppResponse['geocoding_status'];

export async function fetchAppSettings(): Promise<settings.GetAppResponse> {
    return unwrapResponse<settings.GetAppResponse>(backend.api.settings.app.get(), 'Failed to load app settings');
}

export async function updateAppSettings(payload: settings.UpdateAppBody): Promise<settings.UpdateAppResponse> {
    return unwrapResponse<settings.UpdateAppResponse>(backend.api.settings.app.put(payload), 'Failed to update app settings');
}

export async function deleteNet(id: number): Promise<void> {
    await unwrapResponse(backend.api.nets[id.toString()].delete(), 'Failed to delete net');
}

function normalizeCallsignInput(value: string): string {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
        throw new Error('Callsign is required');
    }
    return trimmed.toUpperCase();
}

export async function endNet(id: number): Promise<Net> {
    const data = await unwrapResponse<nets.EndResponse>(backend.api.nets[id.toString()].end.patch(), 'Failed to end net');
    return data.net;
}

export async function restartNet(id: number): Promise<Net> {
    const data = await unwrapResponse<nets.RestartResponse>(backend.api.nets[id.toString()].restart.patch(), 'Failed to restart net');
    return data.net;
}

export async function startNet(id: number): Promise<Net> {
    const data = await unwrapResponse<nets.StartResponse>(backend.api.nets[id.toString()].start.patch(), 'Failed to start net');
    return data.net;
}

export async function endNetFormal(id: number): Promise<Net> {
    const data = await unwrapResponse<nets.EndFormalResponse>(backend.api.nets[id.toString()].endformal.patch(), 'Failed to end formal portion of the net');
    return data.net;
}

export async function resumeNetFormal(id: number): Promise<Net> {
    const data = await unwrapResponse<nets.ResumeFormalResponse>(backend.api.nets[id.toString()].resumeformal.patch(), 'Failed to resume formal portion of the net');
    return data.net;
}

export async function fetchNet(id: number): Promise<Net> {
    const data = await unwrapResponse<nets.GetResponse>(backend.api.nets[id.toString()].get(), 'Failed to fetch net');
    return data.net;
}

export async function createNet(payload: nets.CreateBody): Promise<Net> {
    const data = await unwrapResponse<nets.CreateResponse>(backend.api.nets.post(payload), 'Failed to create net');
    return data.net;
}

export async function updateNet(id: number, payload: nets.UpdateBody): Promise<Net> {
    const data = await unwrapResponse<nets.UpdateResponse>(backend.api.nets[id.toString()].patch(payload), 'Failed to update net');
    return data.net;
}

export async function fetchUsers(): Promise<users.ListResponse['users']> {
    const data = await unwrapResponse<users.ListResponse>(backend.api.users.get(), 'Failed to fetch users');
    return data.users;
}

export async function fetchCheckins(netId: number): Promise<Checkin[]> {
    const data = await unwrapResponse<checkins.ListResponse>(
        backend.api.nets[netId.toString()].checkins.get(),
        'Failed to fetch checkins'
    );
    return data.checkins;
}

export async function createCheckin(netId: number, payload: CreateCheckinRequest): Promise<{ checkin: Checkin; meta: CheckinMeta }> {
    const data = await unwrapResponse<checkins.CreateResponse>(
        backend.api.nets[netId.toString()].checkins.post(payload),
        'Failed to create checkin'
    );
    return data;
}

export async function updateCheckin(id: number, payload: UpdateCheckinPayload): Promise<Checkin> {
    const data = await unwrapResponse<checkins.UpdateResponse>(
        backend.api.checkins[id.toString()].patch(payload),
        'Failed to update checkin'
    );
    return data.checkin;
}

export async function deleteCheckin(id: number): Promise<void> {
    await unwrapResponse(backend.api.checkins[id.toString()].delete(), 'Failed to delete checkin');
}

export async function fetchUser(id: number): Promise<users.GetResponse['user']> {
    const data = await unwrapResponse<users.GetResponse>(backend.api.users[id.toString()].get(), 'Failed to fetch user');
    return data.user;
}

export async function createUser(payload: users.CreateBody): Promise<users.CreateResponse> {
    return unwrapResponse<users.CreateResponse>(backend.api.users.post(payload), 'Failed to create user');
}

export async function updateUser(id: number, payload: users.UpdateBody): Promise<users.UpdateResponse['user']> {
    const data = await unwrapResponse<users.UpdateResponse>(backend.api.users[id.toString()].patch(payload), 'Failed to update user');
    return data.user;
}

export async function deleteUser(id: number): Promise<void> {
    await unwrapResponse(backend.api.users[id.toString()].delete(), 'Failed to delete user');
}

export async function resetUserPassword(id: number): Promise<users.ResetPasswordResponse> {
    return unwrapResponse<users.ResetPasswordResponse>(
        backend.api.users[id.toString()]['reset-password'].post(),
        'Failed to reset user password'
    );
}

export async function fetchMapSettings(): Promise<MapSettings> {
    const data = await unwrapResponse<settings.GetMapResponse>(backend.api.settings.map.get(), 'Failed to load map settings');
    return data.map;
}

export async function updateMapSettings(payload: settings.UpdateMapBody): Promise<MapSettings> {
    const data = await unwrapResponse<settings.UpdateMapResponse>(backend.api.settings.map.put(payload), 'Failed to update map settings');
    return data.map;
}