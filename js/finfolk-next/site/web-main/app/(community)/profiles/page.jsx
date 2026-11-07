import {runCompatibility} from '../../../lib/page-models.js';
import {redirect} from 'next/navigation';
import {profileDestination} from '../../../lib/legacy-redirects.js';
export const metadata={robots:{index:false,follow:false}};
export default async function ProfilesAlias({searchParams}){const target=runCompatibility('profiles-compatibility','profileDestination',profileDestination,['https://finfolk.com.au/profiles',await searchParams]);redirect(target.pathname+target.search);}
