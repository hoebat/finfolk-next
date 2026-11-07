import './migration.css';
import OfflineShell from './offline-shell.jsx';
export const metadata={title:{default:'FinFolk — Discover Freediving',template:'%s · FinFolk'},description:'Find freediving locations, record your sessions and connect with other freedivers.',metadataBase:new URL('https://finfolk.com.au')};
export default function Layout({children}){return <html lang="en" data-theme="yellow" suppressHydrationWarning><head><script src="/appearance.js"/><link rel="icon" href="/finfolk-icon.svg"/></head><body style={{margin:0,background:'var(--account-bg)',color:'var(--account-ink)'}}><OfflineShell/>{children}</body></html>}
