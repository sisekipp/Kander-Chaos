import { useGameStore } from '../../state/store.ts';
import { DriveControls } from './DriveControls.tsx';
import { WalkControls } from './WalkControls.tsx';
import { FlyControls } from './FlyControls.tsx';

/** Wählt die Bedienelemente passend zum Modus (zu Fuß / fahrend / fliegend). */
export function Controls() {
  const mode = useGameStore((s) => s.play.mode);
  const flying = useGameStore((s) => s.flying);
  if (flying) return <FlyControls />;
  return mode === 'driving' ? <DriveControls /> : <WalkControls />;
}
