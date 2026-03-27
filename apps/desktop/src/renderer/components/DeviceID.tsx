import { useState } from 'react';

interface DeviceIDProps {
  deviceId: string;
}

export function DeviceID({ deviceId }: DeviceIDProps) {
  const [copied, setCopied] = useState(false);

  // Format as "ABC-123"
  const formatted =
    deviceId.length > 3
      ? `${deviceId.slice(0, 3)}-${deviceId.slice(3)}`
      : deviceId;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(deviceId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-3xl font-mono font-bold tracking-widest text-foreground">
        {formatted}
      </span>
      <button
        onClick={handleCopy}
        className="rounded-md bg-secondary px-3 py-1.5 text-sm text-secondary-foreground hover:bg-secondary/80 transition-colors"
        title="Copy Device ID"
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
