import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default function AdminSettings() {
  const [status, setStatus] = React.useState<any>(null)

  React.useEffect(() => {
    fetch('/api/admin/db-check').then(res => res.json()).then(setStatus)
  }, [])

  const config = {
    database: status?.ready,
    blob: !!process.env.BLOB_READ_WRITE_TOKEN,
    tribe: !!(process.env.TRIBE_API_URL && process.env.TRIBE_API_KEY),
    aiGateway: !!process.env.LOVABLE_API_KEY
  }

  return (
    <div className="container mx-auto p-8 space-y-6">
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
            {status?.requiredTables?.map((table: string) => (
              <Badge key={table} variant={status?.tables?.includes(table) ? "default" : "destructive"}>
                {table}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
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
