import { useEffect } from 'react';
import { useGameStore } from '../state/store.ts';
import { FIGURE_VARIANTS } from '../player/figureVariants.ts';
import { loadSave, storeFigureVariant } from '../save/saveStore.ts';

const css = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(',')})`;

/** Auswahl der Figurvariante im Menü (gespeichert im Spielstand). */
export function FigurePicker() {
  const variant = useGameStore((s) => s.figureVariant);
  const setVariant = useGameStore((s) => s.setFigureVariant);

  useEffect(() => {
    let alive = true;
    void loadSave().then((s) => {
      if (alive && s) setVariant(s.figure.variant);
    });
    return () => {
      alive = false;
    };
  }, [setVariant]);

  const choose = (v: number) => {
    setVariant(v);
    void storeFigureVariant(v);
  };

  return (
    <fieldset className="figure-picker">
      <legend>Deine Figur</legend>
      <div className="figure-swatches" role="radiogroup" aria-label="Figur wählen">
        {FIGURE_VARIANTS.map((f, i) => (
          <button
            key={f.name}
            role="radio"
            aria-checked={variant === i}
            aria-label={f.name}
            data-testid={`figure-${i}`}
            className={variant === i ? 'figure-swatch selected' : 'figure-swatch'}
            onClick={() => choose(i)}
          >
            <span className="figure-hair" style={{ background: css(f.hair) }} />
            <span className="figure-shirt" style={{ background: css(f.shirt) }} />
            <span className="figure-pants" style={{ background: css(f.pants) }} />
          </button>
        ))}
      </div>
    </fieldset>
  );
}
