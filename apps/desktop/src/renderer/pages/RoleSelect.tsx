import { useNavigate } from 'react-router-dom';

export function RoleSelect() {
  const navigate = useNavigate();

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
    </div>
  );
}
