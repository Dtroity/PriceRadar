import { useEffect, useState } from 'react';

export type BreakpointBand = 'mobile' | 'tablet' | 'desktop';

/** Согласовано с tailwind md=768, lg=1024 */
export function useBreakpoint(): BreakpointBand {
  const [bp, setBp] = useState<BreakpointBand>('desktop');

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (w < 768) setBp('mobile');
      else if (w < 1024) setBp('tablet');
      else setBp('desktop');
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return bp;
}
