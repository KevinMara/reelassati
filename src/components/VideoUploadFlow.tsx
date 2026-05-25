import { useState } from 'react'
import { put } from '@vercel/blob'
import { upload } from '@vercel/blob/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2 } from 'lucide-react'

export default function VideoUploadFlow() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [goal, setGoal] = useState('virality')
  const [platforms, setPlatforms] = useState(['tiktok'])
  const { toast } = useToast()

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    try {
      // 1. Direct upload to Vercel Blob
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/client-upload',
      })

      // 2. Create Job
      const response = await fetch('/api/jobs/create-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blob_url: newBlob.url,
          blob_key: file.name,
          title: file.name,
          goal,
          platform_targets: platforms,
          language: 'en'
        })
      })

      const data = await response.json()
      
      toast({
        title: "Analysis Started",
        description: `Job ID: ${data.job_id}. Status: ${data.status}`
      })

      if (data.status === 'tribe_unavailable') {
        toast({
          variant: "destructive",
          title: "TRIBE Unavailable",
          description: "The GPU inference server is not ready yet. Analysis will resume automatically once online."
        })
      }

    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Upload Failed",
        description: error.message
      })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Analyze New Video</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Video File</Label>
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>

          <div className="space-y-2">
            <Label>Primary Goal</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="virality">Virality</SelectItem>
                <SelectItem value="conversion">Conversion</SelectItem>
                <SelectItem value="brand_awareness">Brand Awareness</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Platforms</Label>
            <div className="flex gap-4">
              {['tiktok', 'instagram_reels', 'youtube_shorts'].map(p => (
                <div key={p} className="flex items-center space-x-2">
                  <Checkbox 
                    id={p} 
                    checked={platforms.includes(p)} 
                    onCheckedChange={(checked) => {
                      if (checked) setPlatforms([...platforms, p])
                      else setPlatforms(platforms.filter(x => x !== p))
                    }}
                  />
                  <label htmlFor={p} className="text-sm capitalize">{p.replace('_', ' ')}</label>
                </div>
              ))}
            </div>
          </div>

          <Button className="w-full" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Start Analysis'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
