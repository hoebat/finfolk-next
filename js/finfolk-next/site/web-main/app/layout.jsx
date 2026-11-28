import {Suspense} from 'react';
import {publicAccountConfig} from '../lib/public-account-config.js';
import './migration.css';
import './product-design.css';
import './workspace-theme.css';
import PreviewControls from './preview-controls.jsx';
import FeatureFlags from './feature-flags.jsx';
import {MobileNavigation} from './app-navigation.jsx';
import SignInOverlay from './sign-in-overlay.jsx';
import ProfileSetup from './profile-setup.jsx';
import OfflineShell from './offline-shell.jsx';
import CacheStatus from './cache-status.jsx';
export const metadata={title:{default:'FinFolk — Discover Freediving',template:'%s · FinFolk'},description:'Find freediving locations, record your sessions and connect with other freedivers.',metadataBase:new URL('https://finfolk.com.au')};
export default function Layout({children}){const config=process.env.NODE_ENV==='production'?publicAccountConfig(process.env):null;return <html lang="en" data-theme="yellow" suppressHydrationWarning><head>{config&&<><script id="finfolk-account-config" type="application/json" dangerouslySetInnerHTML={{__html:JSON.stringify(config).replace(/</g,'\\u003c')}}/><link rel="modulepreload" href="/account-client.js"/><link rel="modulepreload" href="/app-backbone.js"/></>}<script src="/appearance.js"/><link rel="stylesheet" href="/appearance.css" precedence="app"/><link rel="icon" href="/finfolk-icon.svg"/></head><body style={{margin:0,background:'var(--account-bg)',color:'var(--account-ink)'}}><OfflineShell/><CacheStatus/><PreviewControls/><FeatureFlags navigation={<MobileNavigation/>}>{children}<Suspense fallback={null}><SignInOverlay/></Suspense><ProfileSetup/></FeatureFlags></body></html>}
