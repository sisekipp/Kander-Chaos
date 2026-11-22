import { useEffect, useRef } from 'react';
import { Game } from '../engine/Game.ts';
import { setGame } from '../engine/gameInstance.ts';

/**
 * Rendert das Canvas genau einmal und erzeugt die Engine außerhalb des React-Renderzyklus.
 * React rendert pro Bild nichts – die Engine schreibt nur gedrosselt in den Store.
 */
export function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const game = new Game({ canvas: canvasRef.current! });
    setGame(game);
    return () => {
      setGame(null);
      game.dispose();
    };
  }, []);
  return <canvas ref={canvasRef} className="game-canvas" touch-action="none" />;
}
