import { cn } from '../lib/utils';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  quality: 'low' | 'medium' | 'high';
  onQualityChange: (q: 'low' | 'medium' | 'high') => void;
}

export function SettingsDrawer({
  open,
  onClose,
  quality,
  onQualityChange,
}: SettingsDrawerProps) {
  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          'fixed top-0 right-0 h-full w-72 bg-card border-l border-border z-50 p-6 transition-transform duration-300',
          open ? 'translate-x-0' : 'translate-x-full'
        )}
      >
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xl"
          >
            &times;
          </button>
        </div>

        {/* Stream Quality */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-muted-foreground">
            Stream Quality
          </label>
          <div className="flex gap-2">
            {(['low', 'medium', 'high'] as const).map((q) => (
              <button
                key={q}
                onClick={() => onQualityChange(q)}
                className={cn(
                  'flex-1 rounded-md px-3 py-2 text-sm font-medium capitalize transition-colors',
                  quality === q
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
                )}
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
