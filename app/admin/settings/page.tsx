import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

async function getStatus() {
  const requiredTables = [
    'users_profile', 'clients', 'videos', 'jobs', 'tribe_runs', 
    'agent_runs', 'video_analyses', 'scripts', 'edit_plans', 
    'publishing_plans', 'analytics_snapshots', 'platform_learnings', 'cost_events'
  ];

  let ready = false;
  let missingTables: string[] = [];

  try {
    const tablesResult: any[] = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `;
    const existingTables = tablesResult.map(t => t.table_name);
    missingTables = requiredTables.filter(t => !existingTables.includes(t));
    ready = missingTables.length === 0;
  } catch (e) {
    ready = false;
    missingTables = requiredTables;
  }

  // Fetch recent jobs safely
  let recentJobs: any[] = [];
  try {
    const jobs = await prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });
    recentJobs = JSON.parse(JSON.stringify(jobs));
  } catch (e) {}


  return {
    app: "reelassati",
    env: process.env.REELASSATI_APP_ENV || "production",
    database: {
      configured: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
      ready: ready,
      missingTables: missingTables
    },
    blob: {
      configured: Boolean(process.env.BLOB_READ_WRITE_TOKEN)
    },
    aiGateway: {
      configured: Boolean(process.env.AI_GATEWAY_API_KEY)
    },
    tribe: {
      configured: Boolean(process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY),
      status: (process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY) ? "configured" : "pending"
    },
    internal: {
      agentSecretConfigured: Boolean(process.env.INTERNAL_AGENT_SECRET)
    },
    recentJobs: recentJobs
  };
}

export default async function AdminSettingsPage() {
  const status = await getStatus();
  
  // This is a server component, so we can't use hooks.
  // We'll pass the status to a client component for the interactive parts if needed,
  // but for now let's just render the UI server-side as much as possible.
  
  return (
    <div className="container mx-auto p-8 space-y-8">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">System status and configuration overview for {status.app}</p>
        </div>
        <div className="text-right">
          <span className="px-2 py-1 text-xs font-semibold border rounded-full uppercase">{status.env}</span>
          <div className="text-xs text-muted-foreground mt-1">Status as of: {new Date().toLocaleTimeString()}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusBox 
          label="Database" 
          active={status.database.ready} 
          description={status.database.ready ? "Schema synchronized" : (status.database.configured ? "Missing tables" : "Not configured")}
        />
        <StatusBox 
          label="Vercel Blob" 
          active={status.blob.configured} 
          description={status.blob.configured ? "Storage connected" : "Token missing"}
        />
        <StatusBox 
          label="TRIBE Server" 
          active={status.tribe.configured} 
          statusText={status.tribe.status}
          description={status.tribe.configured ? "API ready" : "Config missing"}
        />
        <StatusBox 
          label="AI Gateway" 
          active={status.aiGateway.configured} 
          description={status.aiGateway.configured ? "Model access active" : "Key missing"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 border rounded-lg p-6 bg-card">
          <h2 className="text-lg font-semibold mb-4">Environment</h2>
          <div className="space-y-4">
            <EnvVar label="DATABASE" exists={status.database.configured} />
            <EnvVar label="VERCEL_BLOB" exists={status.blob.configured} />
            <EnvVar label="AI_GATEWAY" exists={status.aiGateway.configured} />
            <EnvVar label="TRIBE_API" exists={status.tribe.configured} />
            <EnvVar label="INTERNAL_AGENT" exists={status.internal.agentSecretConfigured} />
          </div>
        </div>

        <div className="lg:col-span-2 border rounded-lg p-6 bg-card">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Database Health</h2>
            <span className={`px-2 py-1 text-xs font-semibold rounded-full ${status.database.ready ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {status.database.ready ? "Ready" : "Incomplete"}
            </span>
          </div>
          {status.database.missingTables.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium text-destructive">Missing Tables:</p>
              <div className="grid grid-cols-2 gap-2">
                {status.database.missingTables.map((table: string) => (
                  <div key={table} className="text-sm text-destructive flex items-center gap-2">
                    <span>×</span> {table}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-green-600 font-medium flex items-center gap-2">
              <span>✓</span> All required tables exist and are accessible.
            </div>
          )}
        </div>
      </div>

      <div className="border rounded-lg overflow-hidden bg-card">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold">Recent Jobs</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-6 py-3">ID</th>
                <th className="px-6 py-3">Type</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y text-sm">
              {status.recentJobs.map((job: any) => (
                <tr key={job.id}>
                  <td className="px-6 py-4 font-mono text-xs">{job.id.slice(0, 8)}</td>
                  <td className="px-6 py-4 capitalize">{job.jobType.replace('_', ' ')}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${
                      job.status === 'completed' ? 'bg-green-50 text-green-700 border-green-200' :
                      job.status === 'failed' ? 'bg-red-50 text-red-700 border-red-200' :
                      'bg-blue-50 text-blue-700 border-blue-200'
                    }`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-muted-foreground text-xs">
                    {new Date(job.createdAt).toLocaleString()}
                  </td>
                </tr>
              ))}
              {status.recentJobs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-muted-foreground">No jobs found</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBox({ label, active, description, statusText }: any) {
  return (
    <div className={`p-6 border rounded-lg bg-card border-l-4 ${active ? 'border-l-green-500' : 'border-l-amber-500'}`}>
      <div className="space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold">{statusText ? statusText.toUpperCase() : (active ? 'Active' : 'Missing')}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function EnvVar({ label, exists }: any) {
  return (
    <div className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-xs">{label}</span>
      <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${exists ? 'border border-green-200 text-green-600' : 'bg-muted text-muted-foreground'}`}>
        {exists ? "Configured" : "Missing"}
      </span>
    </div>
  );
}
