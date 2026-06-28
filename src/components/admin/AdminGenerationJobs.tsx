import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Activity, CheckCircle2, XCircle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface GenerationJob {
  id: string;
  test_type_code: string | null;
  scope_unit_id: string | null;
  status: "running" | "completed" | "failed" | string;
  total_tasks: number;
  success_count: number;
  skipped_count: number;
  failed_count: number;
  current_label: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  updated_at: string;
}

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Activity }> = {
  running: { label: "Running", variant: "default", icon: Activity },
  completed: { label: "Completed", variant: "secondary", icon: CheckCircle2 },
  failed: { label: "Failed", variant: "destructive", icon: XCircle },
};

export const AdminGenerationJobs = () => {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = async () => {
    const { data } = await supabase
      .from("generation_jobs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(25);
    setJobs((data ?? []) as GenerationJob[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchJobs();
    const channel = supabase
      .channel("generation-jobs-watch")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "generation_jobs" },
        (payload) => {
          setJobs((prev) => {
            const next = [...prev];
            if (payload.eventType === "INSERT") {
              next.unshift(payload.new as GenerationJob);
              return next.slice(0, 25);
            }
            if (payload.eventType === "UPDATE") {
              const idx = next.findIndex((j) => j.id === (payload.new as GenerationJob).id);
              if (idx >= 0) next[idx] = payload.new as GenerationJob;
              else next.unshift(payload.new as GenerationJob);
              return next;
            }
            if (payload.eventType === "DELETE") {
              return next.filter((j) => j.id !== (payload.old as GenerationJob).id);
            }
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Generation Jobs</CardTitle>
          <CardDescription>
            Background jobs triggered from "Generate All Units (Background)" appear here in real time.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground py-8 text-center">
            No jobs yet. Start one from the Generate Questions tab.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold">Generation Jobs</h2>
        <p className="text-sm text-muted-foreground">
          Live progress for bulk content generation. Updates automatically.
        </p>
      </div>

      {jobs.map((job) => {
        const meta = STATUS_META[job.status] ?? STATUS_META.running;
        const Icon = meta.icon;
        const done = job.success_count + job.skipped_count + job.failed_count;
        const pct = job.total_tasks > 0 ? Math.min(100, Math.round((done / job.total_tasks) * 100)) : 0;
        const elapsed = job.finished_at
          ? Math.max(1, Math.round((new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1000))
          : Math.max(1, Math.round((Date.now() - new Date(job.started_at).getTime()) / 1000));

        return (
          <Card key={job.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${job.status === "running" ? "animate-pulse text-primary" : ""}`} />
                    {job.test_type_code ?? "All test types"}
                    {job.scope_unit_id ? <span className="text-muted-foreground text-sm font-normal">• single unit</span> : null}
                  </CardTitle>
                  <CardDescription className="flex items-center gap-2 text-xs">
                    <Clock className="h-3 w-3" />
                    Started {formatDistanceToNow(new Date(job.started_at), { addSuffix: true })} • {elapsed}s elapsed
                  </CardDescription>
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {done} / {job.total_tasks} tasks
                  </span>
                  <span>{pct}%</span>
                </div>
                <Progress value={pct} />
              </div>

              {job.current_label && job.status === "running" && (
                <div className="text-xs text-muted-foreground truncate">
                  <span className="font-medium text-foreground">Now:</span> {job.current_label}
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline" className="gap-1">
                  <CheckCircle2 className="h-3 w-3 text-green-600" />
                  {job.success_count} generated
                </Badge>
                <Badge variant="outline" className="gap-1">
                  Skipped {job.skipped_count}
                </Badge>
                <Badge variant="outline" className="gap-1">
                  <XCircle className="h-3 w-3 text-destructive" />
                  {job.failed_count} failed
                </Badge>
              </div>

              {job.error_message && (
                <div className="text-xs text-destructive border border-destructive/30 bg-destructive/5 rounded p-2">
                  {job.error_message}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
