import { openapi } from '@elysiajs/openapi';
import { Elysia } from 'elysia';

import * as account from './account';
import * as auth from './auth';
import * as checkins from './checkins';
import * as config from './config';
import * as health from './health';
import * as nets from './nets';
import * as settings from './settings';
import * as stations from './stations';
import * as users from './users';

const authRoutes = new Elysia({ prefix: '/auth' })
    .get('/setup-check', auth.setupCheckHandler, auth.setupCheckContract)
    .post('/register-initial', auth.registerInitialHandler, auth.registerInitialContract)
    .post('/login', auth.loginHandler, auth.loginContract)
    .post('/logout', auth.logoutHandler, auth.logoutContract)
    .use(auth.requireAuth)
    .post('/change-password', auth.changePasswordHandler, auth.changePasswordContract)
    .get('/me', auth.meHandler, auth.meContract);

const netsRoutes = new Elysia()
    .use(auth.requireAuth)
    .post('/nets', nets.createHandler, nets.createContract)
    .get('/nets', nets.listHandler, nets.listContract)
    .get('/nets/:id', nets.getHandler, nets.getContract)
    .patch('/nets/:id', nets.updateHandler, nets.updateContract)
    .patch('/nets/:id/end', nets.endHandler, nets.endContract)
    .patch('/nets/:id/start', nets.startHandler, nets.startContract)
    .patch('/nets/:id/restart', nets.restartHandler, nets.restartContract)
    .patch('/nets/:id/endformal', nets.endFormalHandler, nets.endFormalContract)
    .patch('/nets/:id/resumeformal', nets.resumeFormalHandler, nets.resumeFormalContract)
    .delete('/nets/:id', nets.deleteHandler, nets.deleteContract);

const stationsRoutes = new Elysia()
    .use(auth.requireAuth)
    .get('/stations', stations.listHandler, stations.listContract)
    .get('/stations/lookup/:callsign', stations.lookupHandler, stations.lookupContract)
    .get('/stations/:callsign/stats', stations.statsHandler, stations.statsContract)
    .post('/stations/:callsign/refresh-qrz', stations.refreshHandler, stations.refreshContract)
    .put('/stations/:callsign', stations.updateHandler, stations.updateContract)
    .delete('/stations/:callsign', stations.deleteHandler, stations.deleteContract)
    .get('/stations/:callsign', stations.getHandler, stations.getContract);

const usersRoutes = new Elysia()
    .use(auth.requireAdmin)
    .get('/users', users.listHandler, users.listContract)
    .post('/users', users.createHandler, users.createContract)
    .get('/users/:id', users.getHandler, users.getContract)
    .patch('/users/:id', users.updateHandler, users.updateContract)
    .post('/users/:id/reset-password', users.resetPasswordHandler, users.resetPasswordContract)
    .delete('/users/:id', users.deleteHandler, users.deleteContract);

const settingsRoutes = new Elysia()
    .use(auth.requireAdmin)
    .get('/settings/qrz', settings.getHandler, settings.getContract)
    .put('/settings/qrz', settings.updateHandler, settings.updateContract)
    .put('/settings/qrz/mode', settings.updateModeHandler, settings.updateModeContract)
    .delete('/settings/qrz', settings.deleteHandler, settings.deleteContract)
    .put('/settings/app', settings.updateAppHandler, settings.updateAppContract)
    .get('/settings/map', settings.getMapHandler, settings.getMapContract)
    .put('/settings/map', settings.updateMapHandler, settings.updateMapContract);

const configRoutes = new Elysia()
    .use(auth.requireAuth)
    .get('/config', config.getHandler, config.getContract);

const accountRoutes = new Elysia()
    .use(auth.requireAuth)
    .get('/account/qrz', account.getHandler, account.getContract)
    .put('/account/qrz', account.updateHandler, account.updateContract)
    .post('/account/qrz/test', account.testHandler, account.testContract)
    .delete('/account/qrz', account.deleteHandler, account.deleteContract);

const checkinsRoutes = new Elysia()
    .use(auth.requireAuth)
    .get('/nets/:id/checkins', checkins.listHandler, checkins.listContract)
    .post('/nets/:id/checkins', checkins.createHandler, checkins.createContract)
    .patch('/checkins/:id', checkins.updateHandler, checkins.updateContract)
    .delete('/checkins/:id', checkins.deleteHandler, checkins.deleteContract);

export const routes = new Elysia({ prefix: '/api' })
    .use(openapi({
        documentation: {
            info: {
                title: 'NetMinder API',
                description: 'Operational endpoints for NetMinder net management.',
                version: '1.0.0'
            }
        },
        path: '/openapi',
        embedSpec: true,
        scalar: {
            defaultOpenAllTags: true,
            hideDarkModeToggle: true,
            hideClientButton: true
        },
        exclude: { paths: '/*' }
    }))
    .get('/health', health.healthHandler, health.healthContract)
    .use(authRoutes)
    .use(usersRoutes)
    .use(settingsRoutes)
    .use(configRoutes)
    .use(accountRoutes)
    .use(stationsRoutes)
    .use(checkinsRoutes)
    .use(netsRoutes);

export type App = typeof routes;

export {
    account,
    auth,
    checkins,
    config,
    health,
    nets,
    settings,
    stations,
    users
};