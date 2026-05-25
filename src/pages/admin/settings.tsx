import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

export default function AdminSettings() {
  const [dbStatus, setDbStatus] = React.useState<any>(null)
  const [jobData, setJobData] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/admin/db-check').then(res => res.json()).then(setDbStatus)
    fetch('/api/admin/jobs').then(res => res.json()).then(setJobData)
  }, [])

  const config = {
    database: dbStatus?.ready,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    tribe: !!(process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY),
    aiGateway: !!process.env.LOVABLE_API_KEY
  }

  return (
    <div className="container mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold">Admin Settings</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <ConfigCard label="Database" active={config.database} />
        <ConfigCard label="Vercel Blob" active={config.blob} />
        <ConfigCard label="TRIBE Server" active={config.tribe} />
        <ConfigCard label="AI Gateway" active={config.aiGateway} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Required Tables</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {dbStatus?.requiredTables?.map((table: string) => (
              <Badge key={table} variant={dbStatus?.tables?.includes(table) ? "default" : "destructive"}>
                {table}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <JobTable title="Recent Jobs" jobs={jobData?.recentJobs} />
        <JobTable title="Tribe Unavailable Jobs" jobs={jobData?.unavailableJobs} />
      </div>
    </div>
  )
}

function ConfigCard({ label, active }: { label: string, active: boolean }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex justify-between items-center">
          <span className="font-medium">{label}</span>
          <Badge variant={active ? "default" : "secondary"}>
            {active ? "Configured" : "Missing"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

function JobTable({ title, jobs }: { title: string, jobs: any[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ID</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs?.map((job: any) => (
              <TableRow key={job.id}>
                <TableCell className="font-mono text-xs">{job.id.slice(0, 8)}...</TableCell>
                <TableCell>{job.jobType}</TableCell>
                <TableCell>
                  <Badge variant={job.status === 'completed' ? 'default' : job.status === 'tribe_unavailable' ? 'destructive' : 'secondary'}>
                    {job.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
            {(!jobs || jobs.length === 0) && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">No jobs found</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
