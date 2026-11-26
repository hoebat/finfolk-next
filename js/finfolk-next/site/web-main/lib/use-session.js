'use client';
import {useSyncExternalStore} from 'react';
import {browserClient} from './browser-client.js';
import {createSessionStore} from './session-store.js';
const session=createSessionStore(browserClient);
export function useSession(){return {...useSyncExternalStore(session.subscribe,session.getSnapshot,session.getServerSnapshot),retry:session.retry};}
