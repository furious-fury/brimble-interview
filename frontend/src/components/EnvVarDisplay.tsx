import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

interface EnvVarDisplayProps {
  envVars: Record<string, string>;
}

/**
 * Displays environment variables with show/hide toggle for values.
 */
export function EnvVarDisplay({ envVars }: EnvVarDisplayProps) {
  const [showEnvVars, setShowEnvVars] = useState(false);
  const entries = Object.entries(envVars);

  if (entries.length === 0) return null;

  return (
    <div className="mb-8 rounded-sm border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
          Environment Variables
        </p>
        <button
          type="button"
          onClick={() => setShowEnvVars(!showEnvVars)}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
        >
          {showEnvVars ? (
            <>
              <EyeOff className="h-3.5 w-3.5" />
              Hide
            </>
          ) : (
            <>
              <Eye className="h-3.5 w-3.5" />
              Show
            </>
          )}
        </button>
      </div>
      <div className="mt-2 space-y-1 font-mono text-sm">
        {entries.map(([key, value]) => (
          <div key={key} className="flex items-center gap-2">
            <span className="text-slate-600">{key}=</span>
            <span className="text-slate-800">
              {showEnvVars ? value : "•".repeat(Math.min(value.length, 20))}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
