import { useDrag } from '@use-gesture/react';
import { useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Свайп влево (достаточное смещение) */
  onSwipeLeft?: () => void;
  className?: string;
};

/** Строка со свайпом (мобильные списки). */
export default function SwipeableRow({ children, onSwipeLeft, className = '' }: Props) {
  const [x, setX] = useState(0);

  const bind = useDrag(
    ({ down, movement: [mx], cancel }) => {
      if (!onSwipeLeft) return;
      if (!down && mx < -72) {
        onSwipeLeft();
        cancel?.();
        setX(0);
        return;
      }
      setX(down ? Math.min(0, mx) : 0);
    },
    { axis: 'x', filterTaps: true }
  );

  return (
    <div className={`touch-pan-y ${className}`}>
      <div
        {...bind()}
        style={{ transform: x !== 0 ? `translateX(${x}px)` : undefined }}
        className="relative z-10 bg-white"
      >
        {children}
      </div>
    </div>
  );
}
