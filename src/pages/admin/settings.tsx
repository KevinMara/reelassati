import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react'

export default function AdminSettings() {
  const [adminStatus, setAdminStatus] = React.useState<any>(null)
  const [jobData, setJobData] = React.useState<any>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    const fetchData = async () => {
      try {
        const [statusRes, jobsRes] = await Promise.all([
          fetch('/api/admin/status').then(res => res.json()),
          fetch('/api/admin/jobs').then(res => res.json())
        ])
        setAdminStatus(statusRes)
        setJobData(jobsRes)
      } catch (error) {
        console.error('Failed to fetch admin data:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  const database = adminStatus?.database || {}
  const blob = adminStatus?.blob || {}
  const tribe = adminStatus?.tribe || {}
  const aiGateway = adminStatus?.aiGateway || {}
  const internal = adminStatus?.internal || {}

  return (
    <div className="container mx-auto p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">System status and configuration overview for {adminStatus?.app || 'reelassati'}</p>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-1">{adminStatus?.env || 'production'}</Badge>
          <div className="text-xs text-muted-foreground">Last updated: {new Date().toLocaleTimeString()}</div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatusCard 
          label="Database" 
          active={database.ready} 
          description={database.ready ? "Schema synchronized" : (database.configured ? "Missing tables" : "Not configured")}
        />
        <StatusCard 
          label="Vercel Blob" 
          active={blob.configured} 
          description={blob.configured ? "Storage connected" : "Token missing"}
        />
        <StatusCard 
          label="TRIBE Server" 
          active={tribe.configured} 
          statusText={tribe.status}
          description={tribe.configured ? "API ready" : "Config missing"}
        />
        <StatusCard 
          label="AI Gateway" 
          active={aiGateway.configured} 
          description={aiGateway.configured ? "Model access active" : "Key missing"}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Environment Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <EnvVarRow label="DATABASE" exists={database.configured} />
            <EnvVarRow label="VERCEL_BLOB" exists={blob.configured} />
            <EnvVarRow label="AI_GATEWAY" exists={aiGateway.configured} />
            <EnvVarRow label="TRIBE_API" exists={tribe.configured} />
            <EnvVarRow label="INTERNAL_AGENT" exists={internal.agentSecretConfigured} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Database Health</CardTitle>
            <Badge variant={database.ready ? "default" : "destructive"}>
              {database.ready ? "Ready" : "Incomplete"}
            </Badge>
          </CardHeader>
          <CardContent>
            {database.missingTables && database.missingTables.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-destructive">Missing Tables:</p>
                <div className="grid grid-cols-2 gap-2">
                  {database.missingTables.map((table: string) => (
                    <div key={table} className="flex items-center space-x-2 text-sm text-destructive">
                      <XCircle className="w-4 h-4" />
                      <span>{table}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">All required tables exist and are accessible.</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          <JobTable 
            title="Recent Jobs" 
            jobs={jobData?.recentJobs} 
          />
          <JobTable 
            title="Tribe Unavailable Jobs" 
            jobs={jobData?.unavailableJobs} 
            emptyMessage="No unavailable jobs found"
          />
        </div>
      </div>
    </div>
  )
}

function StatusCard({ label, active, description, statusText }: { label: string, active: boolean, description: string, statusText?: string }) {
  return (
    <Card className={`border-l-4 ${active ? 'border-l-green-500' : 'border-l-amber-500'}`}>
      <CardContent className="pt-6">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold">{statusText ? (statusText.charAt(0).toUpperCase() + statusText.slice(1)) : (active ? 'Active' : 'Missing')}</p>
            <p className="text-xs text-muted-foreground">{description}</p>
          </div>
          {active ? (
            <CheckCircle2 className="w-5 h-5 text-green-500" />
          ) : (
            <AlertCircle className="w-5 h-5 text-amber-500" />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function EnvVarRow({ label, exists }: { label: string, exists: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm border-b pb-2 last:border-0 last:pb-0">
      <span className="font-mono text-xs">{label}</span>
      <Badge variant={exists ? "outline" : "secondary"} className={exists ? "text-green-600 border-green-200" : "text-muted-foreground"}>
        {exists ? "Configured" : "Missing"}
      </Badge>
    </div>
  )
}

function JobTable({ title, jobs, emptyMessage = "No jobs found" }: { title: string, jobs: any[], emptyMessage?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs?.map((job: any) => (
                <TableRow key={job.id}>
                  <TableCell className="font-mono text-xs font-medium">{job.id.slice(0, 8)}</TableCell>
                  <TableCell className="capitalize text-xs">{job.jobType.replace('_', ' ')}</TableCell>
                  <TableCell>
                    <Badge 
                      variant="outline" 
                      className={`
                        text-[10px] px-1.5 py-0 capitalize
                        ${job.status === 'completed' ? 'border-green-200 text-green-700 bg-green-50' : 
                          job.status === 'failed' || job.status === 'tribe_unavailable' ? 'border-red-200 text-red-700 bg-red-50' : 
                          'border-blue-200 text-blue-700 bg-blue-50'}
                      `}
                    >
                      {job.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-[10px] text-right text-muted-foreground">
                    {new Date(job.createdAt).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                  </TableCell>
                </TableRow>
              ))}
              {(!jobs || jobs.length === 0) && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground py-8 text-sm">
                    {emptyMessage}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

