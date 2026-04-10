import type { SVGProps } from 'react';

function icon(props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> {
  return {
    ...props,
    className: `shrink-0 w-5 h-5 ${props.className ?? ''}`,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
}

export function IconHome(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

export function IconFileText(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

export function IconCart(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function IconBarChart(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  );
}

export function IconMenu(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

export function IconPanelLeft(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

export function IconImage(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  );
}

export function IconChevronDown(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

export function IconProducts(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <path d="M21 8l-9-5-9 5 9 5 9-5z" />
      <path d="M3 8v8l9 5 9-5V8" />
      <path d="M12 13v8" />
    </svg>
  );
}

export function IconFoodCost(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <path d="M8 3h8a2 2 0 0 1 2 2v16H6V5a2 2 0 0 1 2-2z" />
      <path d="M9 8h6" />
      <path d="M9 12h6" />
      <path d="M9 16h2" />
      <path d="M13 16h2" />
    </svg>
  );
}

export function IconStock(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <path d="M3 9l9-6 9 6" />
      <path d="M5 10v11h14V10" />
      <path d="M9 21v-6h6v6" />
    </svg>
  );
}

export function IconSettings(p: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...icon(p)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a7.9 7.9 0 0 0 .1-6l-2.1.8a6 6 0 0 0-1.4-1.4l.8-2.1a7.9 7.9 0 0 0-6-.1l.8 2.1a6 6 0 0 0-1.4 1.4L6 8.9a7.9 7.9 0 0 0-.1 6l2.1-.8a6 6 0 0 0 1.4 1.4l-.8 2.1a7.9 7.9 0 0 0 6 .1l-.8-2.1a6 6 0 0 0 1.4-1.4z" />
    </svg>
  );
}
