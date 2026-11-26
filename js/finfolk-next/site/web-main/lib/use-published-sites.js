'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {publicSites} from './published-sites.js';
export function usePublishedSites(){const state=useSyncExternalStore(publicSites.subscribe,publicSites.getSnapshot,publicSites.getServerSnapshot);useEffect(()=>{const refresh=()=>publicSites.refresh();window.addEventListener('online',refresh);return()=>window.removeEventListener('online',refresh)},[]);return {...state,refresh:publicSites.refresh}}
