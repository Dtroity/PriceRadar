import type { ReactNode } from 'react';
import PullToRefresh from 'react-pull-to-refresh';

type Props = {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  /** Только на мобильном */
  enabled?: boolean;
};

export default function PullToRefreshContainer({ onRefresh, children, enabled = true }: Props) {
  if (!enabled) return <>{children}</>;

  return (
    <PullToRefresh
      onRefresh={onRefresh}
      className="min-h-[120px]"
      resistance={2.5}
      distanceToRefresh={60}
    >
      {children}
    </PullToRefresh>
  );
}
