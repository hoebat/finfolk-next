// All geographic data is delivered by the dataset service. App code stays local.
export const DATASET_ORIGIN='https://datasets.finfolk.com.au';
export const DATASET_PROVIDER_BASE=DATASET_ORIGIN+'/v1/map/providers/';
// One immutable release owns the catalogue, contours and offline region bytes.
export const DATASET_RELEASE_BASE=DATASET_ORIGIN+'/v1/map/releases/5a4144d050db1f5106ee9e90721c3e5d63fdba6dc7e3ca24f1866ceb038bb657/';
export const osmTileURL=(z,x,y)=>DATASET_PROVIDER_BASE+`osm/${z}/${x}/${y}.png`;
