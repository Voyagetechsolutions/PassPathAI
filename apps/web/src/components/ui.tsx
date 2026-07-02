import type { ReactNode } from 'react';

export function Card({
  children,
  className = '',
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border border-line bg-white shadow-card ${padded ? 'p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}

export function SectionTitle({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-400">{title}</h2>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  tone = 'navy',
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: 'navy' | 'brand' | 'emerald' | 'warn';
}) {
  const tones: Record<string, string> = {
    navy: 'bg-navy-50 text-navy',
    brand: 'bg-brand-50 text-brand',
    emerald: 'bg-emerald-50 text-emerald',
    warn: 'bg-warn-50 text-warn',
  };
  return (
    <Card>
      {icon && (
        <span className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl ${tones[tone]}`}>
          {icon}
        </span>
      )}
      <p className="text-sm font-medium text-ink-400">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      {hint && <p className="mt-1 text-xs text-ink-300">{hint}</p>}
    </Card>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-navy text-white hover:bg-navy-600',
    secondary: 'border border-line bg-white text-ink-600 hover:bg-canvas',
    ghost: 'text-ink-400 hover:text-ink hover:bg-canvas',
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'emerald' | 'warn' | 'danger' }) {
  const tones: Record<string, string> = {
    brand: 'bg-brand',
    emerald: 'bg-emerald',
    warn: 'bg-warn',
    danger: 'bg-danger',
  };
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <div
        className={`h-full rounded-full ${tones[tone]} transition-all`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** A calm circular readiness ring (no glow/gradient). */
export function ScoreRing({
  value,
  size = 132,
  label,
  sublabel,
}: {
  value: number;
  size?: number;
  label?: string;
  sublabel?: string;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  const tone = pct >= 75 ? '#27AE60' : pct >= 50 ? '#2F80ED' : '#F2994A';
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#E8EDF3" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={tone}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tracking-tight text-ink">{Math.round(value)}%</span>
        {label && <span className="mt-0.5 text-xs font-medium text-ink-400">{label}</span>}
        {sublabel && <span className="text-[11px] text-ink-300">{sublabel}</span>}
      </div>
    </div>
  );
}

export function Badge({
  children,
  tone = 'navy',
}: {
  children: ReactNode;
  tone?: 'navy' | 'emerald' | 'warn' | 'danger' | 'muted';
}) {
  const tones: Record<string, string> = {
    navy: 'bg-navy-50 text-navy',
    emerald: 'bg-emerald-50 text-emerald',
    warn: 'bg-warn-50 text-warn',
    danger: 'bg-danger-50 text-danger',
    muted: 'bg-canvas text-ink-400',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-ink-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-brand" />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function PageState({ children }: { children: ReactNode }) {
  return <div className="flex min-h-[40vh] items-center justify-center">{children}</div>;
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-danger-50 bg-danger-50 px-4 py-3 text-sm text-danger">
      {message}
    </div>
  );
}

export function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <Card className="text-center">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-400">{message}</p>
    </Card>
  );
}
