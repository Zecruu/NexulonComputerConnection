import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const { updater } = window.nexulon;

type UpdateStatus = 'idle' | 'checking' | 'available' | 'up-to-date' | 'downloading' | 'ready' | 'error';

export function RoleSelect() {
  const navigate = useNavigate();
  const [version, setVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [updateVersion, setUpdateVersion] = useState('');
  const [downloadPercent, setDownloadPercent] = useState(0);
  const [updateError, setUpdateError] = useState('');

  useEffect(() => {
    updater.getVersion().then((v: string) => setVersion(v));

    updater.onStatus((status: string, data?: any) => {
      switch (status) {
        case 'checking':
          setUpdateStatus('checking');
          break;
        case 'available':
          setUpdateStatus('available');
          setUpdateVersion(data || '');
          break;
        case 'up-to-date':
          setUpdateStatus('up-to-date');
          break;
        case 'downloading':
          setUpdateStatus('downloading');
          setDownloadPercent(Math.round(data || 0));
          break;
        case 'ready':
          setUpdateStatus('ready');
          break;
        case 'error':
          setUpdateStatus('error');
          setUpdateError(data || 'Unknown error');
          break;
      }
    });
  }, []);

  const handleCheckUpdate = async () => {
    setUpdateStatus('checking');
    setUpdateError('');
    const result = await updater.check();
    if (result?.error) {
      setUpdateStatus('error');
      setUpdateError(result.error);
    }
    // Status will be set by the onStatus listener
  };

  const handleDownload = () => {
    setUpdateStatus('downloading');
    setDownloadPercent(0);
    updater.download();
  };

  const handleInstall = () => {
    updater.install();
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-background px-8">
      <h1 className="text-2xl font-bold text-foreground mb-2">Nexulon Connect</h1>
      <p className="text-sm text-muted-foreground mb-12">
        How would you like to use this app?
      </p>

      <div className="flex gap-6 w-full max-w-lg">
        {/* Customer / Need Help */}
        <button
          onClick={() => navigate('/help')}
          className="flex-1 flex flex-col items-center gap-4 p-8 rounded-xl border border-border bg-card hover:border-green-500/50 hover:bg-green-500/5 transition-all group"
        >
          <span className="text-5xl group-hover:scale-110 transition-transform">
            &#9997;
          </span>
          <span className="text-lg font-semibold text-foreground">
            I Need Help
          </span>
          <span className="text-xs text-muted-foreground text-center">
            Request remote support from your IT team
          </span>
        </button>

        {/* Support Agent */}
        <button
          onClick={() => navigate('/portal')}
          className="flex-1 flex flex-col items-center gap-4 p-8 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all group"
        >
          <span className="text-5xl group-hover:scale-110 transition-transform">
            &#128736;
          </span>
          <span className="text-lg font-semibold text-foreground">
            Support Agent
          </span>
          <span className="text-xs text-muted-foreground text-center">
            View devices and provide remote assistance
          </span>
        </button>
      </div>

      {/* Version + Update section */}
      <div className="mt-12 flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground">v{version}</p>

        {updateStatus === 'idle' && (
          <button
            onClick={handleCheckUpdate}
            className="text-xs text-primary hover:text-primary/80 transition-colors"
          >
            Check for updates
          </button>
        )}

        {updateStatus === 'checking' && (
          <p className="text-xs text-muted-foreground">Checking for updates...</p>
        )}

        {updateStatus === 'up-to-date' && (
          <p className="text-xs text-green-400">You're up to date</p>
        )}

        {updateStatus === 'available' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-primary">v{updateVersion} available</p>
            <button
              onClick={handleDownload}
              className="rounded-md bg-primary px-4 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Download Update
            </button>
          </div>
        )}

        {updateStatus === 'downloading' && (
          <div className="flex flex-col items-center gap-1 w-48">
            <p className="text-xs text-muted-foreground">Downloading... {downloadPercent}%</p>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${downloadPercent}%` }}
              />
            </div>
          </div>
        )}

        {updateStatus === 'ready' && (
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-green-400">Update ready to install</p>
            <button
              onClick={handleInstall}
              className="rounded-md bg-green-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-green-500 transition-colors"
            >
              Restart & Install
            </button>
          </div>
        )}

        {updateStatus === 'error' && (
          <div className="flex flex-col items-center gap-1">
            <p className="text-xs text-destructive">{updateError}</p>
            <button
              onClick={handleCheckUpdate}
              className="text-xs text-primary hover:text-primary/80 transition-colors"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
