let pending;
// Stable authored browser assets share telemetry with the map/data engines.
export function browserActivity(){return pending??=import(/* webpackIgnore: true */ '/activity.js');}
