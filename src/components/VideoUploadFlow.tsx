import { useState, useEffect } from 'react'
import { upload } from '@vercel/blob/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function VideoUploadFlow() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [goal, setGoal] = useState('virality')
  const [platforms, setPlatforms] = useState(['tiktok'])
  const [activeJobId, setActiveJobId] = useState<string | null>(null)
  const [jobStatus, setJobStatus] = useState<any>(null)
  const [analysis, setAnalysis] = useState<any>(null)
  const { toast } = useToast()

  // Poll for job status
  useEffect(() => {
    let interval: any
    if (activeJobId && (!jobStatus || (jobStatus.status !== 'completed' && jobStatus.status !== 'failed' && jobStatus.status !== 'tribe_unavailable'))) {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/jobs/${activeJobId}`)
          const data = await res.json()
          setJobStatus(data)
          
          if (data.status === 'completed') {
            const analysisRes = await fetch(`/api/videos/${data.videoId}/analysis`)
            const analysisData = await analysisRes.json()
            setAnalysis(analysisData)
            clearInterval(interval)
          } else if (data.status === 'tribe_unavailable' || data.status === 'failed') {
            clearInterval(interval)
          }
        } catch (e) {
          console.error('Polling error:', e)
        }
      }, 3000)
    }
    return () => clearInterval(interval)
  }, [activeJobId, jobStatus])

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setAnalysis(null)
    setJobStatus(null)
    
    try {
      const newBlob = await upload(file.name, file, {
        access: 'public',
        handleUploadUrl: '/api/blob/client-upload',
      })

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
      setActiveJobId(data.job_id)
      
      toast({
        title: "Analysis Initialized",
        description: `Status: ${data.status}`
      })

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

  if (activeJobId && jobStatus) {
    return (
      <div className="max-w-4xl mx-auto py-12 px-4 space-y-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Job Status: {activeJobId.slice(0, 8)}...</CardTitle>
            <Badge variant={
              jobStatus.status === 'completed' ? 'default' : 
              jobStatus.status === 'tribe_unavailable' ? 'destructive' : 'secondary'
            }>
              {jobStatus.status.replace('_', ' ')}
            </Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {jobStatus.status === 'waiting_for_tribe' && (
              <div className="flex flex-col items-center py-8 space-y-4 text-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">Analyzing Biometric Signals</h3>
                  <p className="text-muted-foreground">The TRIBE GPU server is processing your video. This usually takes 1-2 minutes.</p>
                </div>
              </div>
            )}

            {jobStatus.status === 'tribe_unavailable' && (
              <div className="flex flex-col items-center py-8 space-y-4 text-center">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-destructive">TRIBE Analysis Unavailable</h3>
                  <p className="text-muted-foreground max-w-md">
                    TRIBE analysis is unavailable because the GPU inference server is not ready. 
                    No fake scores will be generated. Analysis will resume automatically once the server is back online.
                  </p>
                </div>
              </div>
            )}

            {jobStatus.status === 'completed' && analysis && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card className="bg-primary/5">
                    <CardHeader>
                      <CardTitle className="text-lg">AI Verdict</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm italic">"{analysis.data?.verdict || analysis.verdict}"</p>
                    </CardContent>
                  </Card>
                  
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Scorecard</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {Object.entries((analysis.data?.scorecard || analysis.scorecard || {})).map(([key, val]: [string, any]) => (
                        <div key={key} className="flex justify-between items-center border-b pb-2 last:border-0">
                          <span className="text-sm font-medium capitalize">{key.replace('_', ' ')}</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{val.score}/100</Badge>
                            <span className="text-[10px] text-muted-foreground uppercase">{val.confidence} confidence</span>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-4">
                  <h3 className="text-xl font-bold">Top Improvements</h3>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {(analysis.data?.top_improvements || analysis.top_improvements || []).map((imp: string, i: number) => (
                      <li key={i} className="flex items-start gap-2 bg-secondary/30 p-3 rounded-md text-sm">
                        <CheckCircle2 className="h-4 w-4 mt-0.5 text-primary" />
                        {imp}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <Button variant="outline" onClick={() => setActiveJobId(null)}>Analyze Another Video</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    )
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
                <SelectItem value="education">Education</SelectItem>
                <SelectItem value="entertainment">Entertainment</SelectItem>
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

          <Button className="w-full h-12 text-lg" disabled={!file || uploading} onClick={handleUpload}>
            {uploading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Uploading...</>
            ) : (
              'Start Analysis'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
