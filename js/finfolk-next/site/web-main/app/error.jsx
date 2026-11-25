'use client';
export default function ErrorPage({reset}){return <section role="alert"><h1>Could not load this page</h1><p>The page could not load its data. Please try again.</p><button onClick={reset}>Try again</button></section>}
