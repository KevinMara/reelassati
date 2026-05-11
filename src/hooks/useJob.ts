import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

export function useJob(jobId: string | null) {
  const [job, setJob] = useState<any>(null)
  
  // Initial fetch
  useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null
      const { data } = await supabase.from('jobs').select('*').eq('id', jobId).single()
      setJob(data)
      return data
    },
    enabled: !!jobId
  })
  
  // Realtime subscription
  useEffect(() => {
    if (!jobId) return
    
    const channel = supabase
      .channel(`job-${jobId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'jobs',
        filter: `id=eq.${jobId}`
      }, (payload) => {
        setJob(payload.new)
      })
      .subscribe()
    
    return () => { supabase.removeChannel(channel) }
  }, [jobId])
  
  return job
}
