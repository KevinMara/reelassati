import { useEffect, useRef, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export type AgentName = "analyzer" | "scriptwriter" | "editor" | "publisher" | "analytics";

export type AgentJob = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  progress_pct: number;
  progress_message: string | null;
  result: any;
  agent_name: string;
  job_type: string;
  created_at: string;
  client_id: string | null;
};

/**
 * Submits an agent job and tracks it via realtime + polling fallback.
 * Returns helpers to start a job and the latest job state.
 */
export function useAgentJob(agent: AgentName) {
  const [job, setJob] = useState<AgentJob | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pollRef = useRef<number | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const subscribe = useCallback((jobId: string) => {
    cleanup();
    channelRef.current = supabase
      .channel(`job:${jobId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
        (payload) => {
          setJob((prev) => ({ ...(prev ?? ({} as AgentJob)), ...(payload.new as AgentJob) }));
        },
      )
      .subscribe();

    // Polling fallback every 1.5s
    pollRef.current = window.setInterval(async () => {
      const { data } = await supabase.from("jobs").select("*").eq("id", jobId).maybeSingle();
      if (data) {
        setJob(data as AgentJob);
        if (data.status === "completed" || data.status === "failed") cleanup();
      }
    }, 1500);
  }, [cleanup]);

  const start = useCallback(
    async (opts: { jobType: string; payload: Record<string, unknown>; clientId?: string | null }) => {
      setSubmitting(true);
      try {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData.user) throw new Error("Not authenticated");

        const { data: inserted, error: insertErr } = await supabase
          .from("jobs")
          .insert({
            user_id: userData.user.id,
            client_id: opts.clientId ?? null,
            agent_name: agent,
            job_type: opts.jobType,
            payload: opts.payload as any,
            status: "queued",
          })
          .select()
          .single();
        if (insertErr || !inserted) throw insertErr ?? new Error("Failed to create job");

        setJob(inserted as AgentJob);
        subscribe(inserted.id);

        // Fire and forget — function will mutate the job row.
        supabase.functions
          .invoke("run-agent", { body: { job_id: inserted.id } })
          .then(({ error }) => {
            if (error) {
              toast({
                title: "Agent failed",
                description: error.message,
                variant: "destructive",
              });
            }
          });

        return inserted as AgentJob;
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        toast({ title: "Could not start job", description: msg, variant: "destructive" });
        throw e;
      } finally {
        setSubmitting(false);
      }
    },
    [agent, subscribe],
  );

  const reset = useCallback(() => {
    cleanup();
    setJob(null);
  }, [cleanup]);

  return { job, submitting, start, reset };
}
