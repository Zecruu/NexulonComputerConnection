import { cn } from '../lib/utils';

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

export function ToggleSwitch({ checked, onChange, disabled }: ToggleSwitchProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'switch-track relative inline-flex h-16 w-28 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'bg-green-500' : 'bg-secondary'
      )}
    >
      <span
        className={cn(
          'switch-thumb pointer-events-none block h-12 w-12 rounded-full bg-white shadow-lg',
          checked ? 'translate-x-14' : 'translate-x-1'
        )}
      />
    </button>
  );
}
