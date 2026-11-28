// Preserve a sign-in click until the shared overlay has finished mounting.
let pending=null,listener=null;
export function requestSignIn(href,element){const request={href,element};if(listener)listener(request);else pending=request;}
export function observeSignInRequests(next){listener=next;const request=pending;pending=null;if(request)next(request);return()=>{if(listener===next)listener=null;};}
