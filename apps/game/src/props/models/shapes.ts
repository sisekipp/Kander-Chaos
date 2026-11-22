import { PropShape } from '@kandern/world-format';

export { PROP_SHAPE_COUNT, PropShape, SHAPE_KIND, propShape } from '@kandern/world-format';

/** Modell-ID jeder Form in der Registry (`public/models/manifest.json`). */
export const SHAPE_MODELS: Record<PropShape, string> = {
  [PropShape.BushRound]: 'bush-round',
  [PropShape.BushTall]: 'bush-tall',
  [PropShape.Bin]: 'bin-street',
  [PropShape.Fence]: 'fence-garden',
  [PropShape.Sign]: 'sign-stvo',
  [PropShape.TrafficLight]: 'traffic-light',
  [PropShape.Lamp]: 'lamp-street',
  [PropShape.Bench]: 'bench-park',
  [PropShape.SignTriangle]: 'sign-triangle',
  [PropShape.SignBlue]: 'sign-crossing',
  [PropShape.BusStop]: 'sign-busstop',
  [PropShape.PostBox]: 'postbox',
  [PropShape.Hydrant]: 'hydrant',
  [PropShape.Bollard]: 'bollard',
  [PropShape.BikeRack]: 'bike-rack',
  [PropShape.AdColumn]: 'ad-column',
  [PropShape.Planter]: 'planter',
};
