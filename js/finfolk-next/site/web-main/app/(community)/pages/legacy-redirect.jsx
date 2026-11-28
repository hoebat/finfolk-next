'use client';
import {useEffect} from 'react';
import {useAppSearchParams} from '../../../lib/use-app-router.js';
// Retain the old static/offline entry point while Pages owns the UI.
export default function LegacyPagesRedirect(){const params=useAppSearchParams(),search=params.toString();useEffect(()=>{const values=new URLSearchParams(search),query=new URLSearchParams({manage:'1'});for(const key of ['create','category','state','country','locality','site','q'])if(values.getAll(key).length===1)query.set(key,values.get(key));window.location.replace('/directory?'+query+window.location.hash);},[search]);return <p role="status">Opening Pages…</p>;}
