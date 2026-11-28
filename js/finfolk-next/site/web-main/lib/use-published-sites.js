'use client';
import {useEffect,useSyncExternalStore} from 'react';
import {publicSites} from './published-sites.js';
export function usePublishedSites(enabled=true){const state=useSyncExternalStore(enabled?publicSites.subscribe:()=>()=>{},publicSites.getSnapshot,publicSites.getServerSnapshot);useEffect(()=>{if(!enabled)return;const refresh=()=>publicSites.refresh();window.addEventListener('online',refresh);return()=>window.removeEventListener('online',refresh)},[enabled]);return {...state,refresh:publicSites.refresh}}
