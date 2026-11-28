// A separate binding, inbox and queue prevent cross-provider work consumption.
import {createNativeSocialWorker} from './social-worker.mjs';
export default createNativeSocialWorker({provider:'tiktok'});
