type LogoProps = {
  collapsed?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

export function Logo({ collapsed = false, size = 'md', className = '' }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <img
        src="/logo.svg"
        alt="Vizor360"
        className={size === 'md' ? 'h-8 w-8' : 'h-6 w-6'}
      />
      {!collapsed && (
        <div className="flex flex-col leading-none">
          <span className="tracking-tight font-semibold text-slate-900">
            Vizor<span style={{ color: 'var(--brand-primary)' }}>360</span>
          </span>
          {size === 'md' && (
            <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)]">
              Контроль закупок
            </span>
          )}
        </div>
      )}
    </div>
  );
}
