'use client';
export default function ErrorPage({reset}){return <section role="alert"><h1>Could not load this page</h1><p>Please check your connection and try again.</p><button onClick={reset}>Try again</button></section>}
