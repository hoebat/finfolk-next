'use client';
import SiteAdmin from './sites.jsx';
import PostReview from './posts.jsx';
import TripReview from './trips.jsx';
export default function Review({session,sites}){return <><SiteAdmin session={session} sites={sites}/><PostReview session={session}/><TripReview session={session}/></>}
