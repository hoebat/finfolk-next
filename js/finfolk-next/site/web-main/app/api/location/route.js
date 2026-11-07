import {locationResponse} from '../../../lib/location-hint.js';
// Plain Next.js has no trusted IP geolocation. Netlify's native function owns this path there.
export function GET(){return locationResponse(null);}
