import { useGameStore } from '../../state/store.ts';
import { DriveControls } from './DriveControls.tsx';
import { WalkControls } from './WalkControls.tsx';

/** Wählt die Bedienelemente passend zum Modus (zu Fuß / fahrend). */
export function Controls() {
  const mode = useGameStore((s) => s.play.mode);
  return mode === 'driving' ? <DriveControls /> : <WalkControls />;
}
