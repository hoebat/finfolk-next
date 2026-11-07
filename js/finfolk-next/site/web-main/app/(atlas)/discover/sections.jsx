'use client';
import {useEffect} from 'react';
import {useAtlas} from '../atlas/runtime.jsx';
// Route content renders in the discovery tree; its host remains owned by that tree.
export default function Sections({directoryPage,eventsPage}){const {registerSlots}=useAtlas();useEffect(()=>registerSlots({directoryPage,eventsPage}),[registerSlots,directoryPage,eventsPage]);return null;}
