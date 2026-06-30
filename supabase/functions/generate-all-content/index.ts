// Orchestrator: generate all questions/passages/vocabulary for every unit
// across one test type (or all). Runs in the background after returning.
//
// Design:
// - Initial request builds the full task list and inserts a generation_jobs row
//   with pending_tasks = the work queue.
// - The background worker processes a small CHUNK_SIZE per invocation, then
//   re-invokes this same function with { resume_job_id } until the queue is empty.
//   This avoids edge-function wall-clock timeouts on large batches.
// - Each child call is retried with backoff. Failures are appended to
//   generation_jobs.task_errors so the admin UI can show reasons.
//
// Body:
//   Initial:  { test_type_code?: string, unit_id?: string, only_incomplete?: boolean }
//   Resume :  { resume_job_id: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const QUESTION_GAME_TYPES = new Set(["context_master", "cloze_challenge"]);
const MAX_PASSAGE_ITERATIONS = 5;
// Keep small so a chunk fits well under edge-function wall-clock limits.
const CHUNK_SIZE = 6;
// Cap how many failure entries we persist per job (oldest dropped).
const MAX_ERROR_ENTRIES = 100;
// Per child invocation retry policy.
const RETRY_ATTEMPTS = 3; // total attempts including first try
const RETRY_BACKOFF_MS = 1500;

type Unit = {
  id: string;
  title: string;
  unit_number: number;
  test_type_id: string;
  words: string[];
};

type Game = {
  id: string;
  game_type: string;
  rules: Record<string, unknown> | null;
};

type TestType = { id: string; code: string };

type QueuedTask = { u: string; g: string; t: string };

type TaskError = {
  at: string;
  unit_id: string;
  unit_title: string;
  game_id: string;
  game_type: string;
  fn: string;
  status?: number;
  message: string;
};

const log = (msg: string, extra?: unknown) => {
  const tail = extra !== undefined ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[GENERATE-ALL] ${msg}${tail}`);
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveGenerator(
  gameType: string,
): { fn: string; isPassage: boolean } | null {
  if (gameType === "flashcards") return { fn: "generate-vocabulary", isPassage: false };
  if (gameType === "gap_fill_passage") return { fn: "generate-gap-fill-passage", isPassage: true };
  if (gameType === "linked_extracts") return { fn: "generate-cloze-passage", isPassage: true };
  if (gameType === "reading") return { fn: "generate-passage", isPassage: true };
  if (QUESTION_GAME_TYPES.has(gameType)) return { fn: "generate-test-questions", isPassage: false };
  return null;
}

/**
 * Returns true if (unit, game) already meets its content requirement.
 * Mirrors AdminContentStats so the background job aligns with the UI.
 */
async function isGameComplete(
  admin: ReturnType<typeof createClient>,
  unit: Unit,
  game: Game,
): Promise<boolean> {
  const words = Array.isArray(unit.words) ? unit.words : [];
  const totalWords = words.length;
  if (totalWords === 0) return true;
  const rules = (game.rules ?? {}) as Record<string, number>;

  if (game.game_type === "flashcards") {
    const { data: vocabData } = await admin
      .from("vocabulary")
      .select("word, review_status")
      .eq("unit_id", unit.id);
    const vocab = (vocabData ?? []) as Array<{ word: string | null; review_status: string | null }>;
    const lowerWords = words.map((w) => w.toLowerCase());
    let nonRejectedUnique = 0;
    for (const w of lowerWords) {
      const matches = vocab.filter((v) => v.word?.toLowerCase() === w);
      if (matches.length === 0) continue;
      if (matches.some((m) => m.review_status !== "rejected")) nonRejectedUnique++;
    }
    return nonRejectedUnique >= totalWords;
  }

  if (game.game_type === "reading" || game.game_type === "linked_extracts" || game.game_type === "gap_fill_passage") {
    const passagesPerGame = Number(rules.passages_per_game ?? 3);
    const questionsPerPassage = Number(rules.questions_per_passage ?? 10);

    const { data: allPassagesRaw } = await admin
      .from("reading_passages")
      .select("id, review_status, title")
      .eq("unit_id", unit.id);
    let allPassages = (allPassagesRaw ?? []) as Array<{ id: string; review_status: string | null; title: string | null }>;

    if (game.game_type === "linked_extracts") {
      allPassages = allPassages.filter((p) => /^(linked extracts:|cloze passage:)/i.test(p.title ?? ""));
    } else if (game.game_type === "gap_fill_passage") {
      allPassages = allPassages.filter((p) => /^gap fill passage:/i.test(p.title ?? ""));
    } else {
      allPassages = allPassages.filter((p) => {
        const t = (p.title ?? "").toLowerCase();
        return !t.startsWith("linked extracts:") && !t.startsWith("cloze passage:") && !t.startsWith("gap fill passage:");
      });
    }

    const passageIds = allPassages.map((p) => p.id);
    if (passageIds.length === 0) return false;

    const { data: qData } = await admin
      .from("question_bank")
      .select("passage_id, review_status")
      .eq("game_id", game.id)
      .eq("unit_id", unit.id)
      .in("passage_id", passageIds);
    const questions = (qData ?? []) as Array<{ passage_id: string | null; review_status: string | null }>;

    const byPassage = new Map<string, number>();
    for (const q of questions) {
      if (!q.passage_id || q.review_status === "rejected") continue;
      byPassage.set(q.passage_id, (byPassage.get(q.passage_id) ?? 0) + 1);
    }

    let validCount = 0;
    for (const p of allPassages) {
      if (p.review_status === "rejected") continue;
      if ((byPassage.get(p.id) ?? 0) >= questionsPerPassage) validCount++;
    }
    return validCount >= passagesPerGame;
  }

  if (QUESTION_GAME_TYPES.has(game.game_type)) {
    const questionsPerWord = Number(rules.questions_per_word ?? 3);
    const required = totalWords * questionsPerWord;
    const lowerWords = new Set(words.map((w) => w.toLowerCase()));

    const { data: qData } = await admin
      .from("question_bank")
      .select("word, review_status")
      .eq("game_id", game.id)
      .eq("unit_id", unit.id);
    const all = (qData ?? []) as Array<{ word: string | null; review_status: string | null }>;
    const inUnit = all.filter((q) => q.word && lowerWords.has(q.word.toLowerCase()));
    const nonRejected = inUnit.filter((q) => q.review_status !== "rejected").length;
    return nonRejected >= required;
  }

  return true;
}

async function invokeChild(
  fnName: string,
  payload: Record<string, unknown>,
  authHeader: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
      apikey: SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(payload),
  });
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => null);
  }
  return { ok: res.ok, status: res.status, body };
}

async function invokeChildWithRetry(
  fnName: string,
  payload: Record<string, unknown>,
  authHeader: string,
): Promise<{ ok: boolean; status: number; body: unknown; attempts: number; lastError?: string }> {
  let lastError = "";
  let lastStatus = 0;
  let lastBody: unknown = null;
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      const r = await invokeChild(fnName, payload, authHeader);
      if (r.ok) return { ...r, attempts: attempt };
      lastStatus = r.status;
      lastBody = r.body;
      const bodyMsg =
        typeof r.body === "object" && r.body && "error" in r.body
          ? String((r.body as { error: unknown }).error)
          : typeof r.body === "string"
            ? r.body
            : JSON.stringify(r.body);
      lastError = `HTTP ${r.status}: ${bodyMsg?.slice(0, 400) ?? "no body"}`;
      // Don't retry auth or validation errors
      if (r.status === 401 || r.status === 403 || r.status === 400) break;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    if (attempt < RETRY_ATTEMPTS) await sleep(RETRY_BACKOFF_MS * attempt);
  }
  return { ok: false, status: lastStatus, body: lastBody, attempts: RETRY_ATTEMPTS, lastError };
}

async function selfInvokeResume(jobId: string, authHeader: string) {
  // Fire-and-forget chain — we don't await the response body.
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/generate-all-content`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ resume_job_id: jobId }),
    });
  } catch (err) {
    log("self-invoke failed", { jobId, err: String(err) });
  }
}

async function processChunk(
  jobId: string,
  authHeader: string,
  admin: ReturnType<typeof createClient>,
) {
  // Reload job snapshot
  const { data: jobRow, error: jobLoadErr } = await admin
    .from("generation_jobs")
    .select(
      "id, status, pending_tasks, task_errors, success_count, skipped_count, failed_count",
    )
    .eq("id", jobId)
    .single();
  if (jobLoadErr || !jobRow) {
    log("processChunk: job not found", { jobId, err: String(jobLoadErr) });
    return;
  }
  if (jobRow.status !== "running") {
    log("processChunk: job not running, exit", { jobId, status: jobRow.status });
    return;
  }

  const pending = (jobRow.pending_tasks ?? []) as QueuedTask[];
  if (pending.length === 0) {
    await admin
      .from("generation_jobs")
      .update({
        status: "completed",
        current_label: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    log("Job completed", { jobId });
    return;
  }

  const chunk = pending.slice(0, CHUNK_SIZE);
  const remainingAfterChunk = pending.slice(CHUNK_SIZE);

  // Hydrate units and games used by this chunk
  const unitIds = Array.from(new Set(chunk.map((t) => t.u)));
  const gameIds = Array.from(new Set(chunk.map((t) => t.g)));

  const [{ data: unitsData }, { data: gamesData }] = await Promise.all([
    admin.from("units").select("id, title, unit_number, test_type_id, words").in("id", unitIds),
    admin.from("games").select("id, game_type, rules").in("id", gameIds),
  ]);
  const unitsById = new Map<string, Unit>(((unitsData ?? []) as Unit[]).map((u) => [u.id, u]));
  const gamesById = new Map<string, Game>(((gamesData ?? []) as Game[]).map((g) => [g.id, g]));

  let success = jobRow.success_count ?? 0;
  let skipped = jobRow.skipped_count ?? 0;
  let failed = jobRow.failed_count ?? 0;
  const taskErrors = ((jobRow.task_errors ?? []) as TaskError[]).slice();

  const recordError = (entry: TaskError) => {
    taskErrors.push(entry);
    if (taskErrors.length > MAX_ERROR_ENTRIES) {
      taskErrors.splice(0, taskErrors.length - MAX_ERROR_ENTRIES);
    }
  };

  for (let i = 0; i < chunk.length; i++) {
    const task = chunk[i];
    const unit = unitsById.get(task.u);
    const game = gamesById.get(task.g);
    if (!unit || !game) {
      failed++;
      recordError({
        at: new Date().toISOString(),
        unit_id: task.u,
        unit_title: unit?.title ?? "(missing unit)",
        game_id: task.g,
        game_type: game?.game_type ?? "?",
        fn: "(prep)",
        message: "Unit or game row not found",
      });
      continue;
    }
    const words = Array.isArray(unit.words) ? unit.words : [];
    if (words.length === 0) {
      skipped++;
      continue;
    }
    const gen = resolveGenerator(game.game_type);
    if (!gen) {
      skipped++;
      continue;
    }

    // Update current_label + remove this task from queue progressively so
    // restarts after a crash don't re-run the in-flight task forever.
    const progressivePending = [...chunk.slice(i + 1), ...remainingAfterChunk];
    await admin
      .from("generation_jobs")
      .update({
        current_label: `${task.t} • ${unit.title} • ${game.game_type}`,
        pending_tasks: progressivePending,
      })
      .eq("id", jobId);

    let payload: Record<string, unknown>;
    if (gen.fn === "generate-vocabulary") {
      payload = { unit_id: unit.id, words };
    } else if (gen.fn === "generate-test-questions") {
      payload = {
        unit_id: unit.id,
        words,
        game_type: game.game_type,
        game_id: game.id,
        test_type_code: task.t,
      };
    } else {
      payload = {
        unit_id: unit.id,
        words,
        test_type_code: task.t,
        unit_title: unit.title,
      };
    }

    const iterations = gen.isPassage ? MAX_PASSAGE_ITERATIONS : 1;
    for (let iter = 0; iter < iterations; iter++) {
      const result = await invokeChildWithRetry(gen.fn, payload, authHeader);
      if (!result.ok) {
        failed++;
        recordError({
          at: new Date().toISOString(),
          unit_id: unit.id,
          unit_title: unit.title,
          game_id: game.id,
          game_type: game.game_type,
          fn: gen.fn,
          status: result.status,
          message: result.lastError ?? "Unknown failure",
        });
        log(`FAIL ${gen.fn}`, {
          unit: unit.title,
          game: game.game_type,
          status: result.status,
          attempts: result.attempts,
        });
        break;
      }
      const body = result.body as { skipped?: boolean } | null;
      if (gen.isPassage && body?.skipped) {
        skipped++;
        break;
      }
      success++;
      if (!gen.isPassage) break;
    }

    await admin
      .from("generation_jobs")
      .update({
        success_count: success,
        skipped_count: skipped,
        failed_count: failed,
        task_errors: taskErrors,
      })
      .eq("id", jobId);
  }

  // Chunk done. Either chain to next chunk or complete.
  if (remainingAfterChunk.length > 0) {
    await admin
      .from("generation_jobs")
      .update({ pending_tasks: remainingAfterChunk })
      .eq("id", jobId);
    log("Chunk done, chaining", { jobId, remaining: remainingAfterChunk.length });
    await selfInvokeResume(jobId, authHeader);
  } else {
    await admin
      .from("generation_jobs")
      .update({
        status: "completed",
        current_label: null,
        finished_at: new Date().toISOString(),
        pending_tasks: [],
      })
      .eq("id", jobId);
    log("Job completed", { jobId, success, skipped, failed });
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    const { data: isAdminData, error: isAdminErr } = await admin.rpc("is_admin", {
      p_user_id: userId,
    });
    if (isAdminErr || !isAdminData) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      test_type_code?: string;
      unit_id?: string;
      only_incomplete?: boolean;
      resume_job_id?: string;
    };

    // ===== Resume path =====
    if (body.resume_job_id) {
      const jobId = body.resume_job_id;
      // Process synchronously-in-background so this invocation can return fast.
      // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime
      EdgeRuntime.waitUntil(processChunk(jobId, authHeader, admin));
      return new Response(
        JSON.stringify({ success: true, resumed: true, job_id: jobId }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ===== Initial path =====
    const onlyIncomplete = body.only_incomplete !== false;

    const { data: testTypes } = await admin
      .from("test_types")
      .select("id, code")
      .eq("is_enabled", true);
    const allTestTypes = (testTypes ?? []) as TestType[];

    const filteredTestTypes = body.test_type_code
      ? allTestTypes.filter((t) => t.code === body.test_type_code)
      : allTestTypes;
    if (filteredTestTypes.length === 0) {
      return new Response(JSON.stringify({ error: "No matching test types" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const testTypeIds = filteredTestTypes.map((t) => t.id);
    const testTypeCodeById = new Map(filteredTestTypes.map((t) => [t.id, t.code]));

    let unitsQuery = admin
      .from("units")
      .select("id, title, unit_number, test_type_id, words")
      .in("test_type_id", testTypeIds)
      .order("test_type_id")
      .order("unit_number");
    if (body.unit_id) unitsQuery = unitsQuery.eq("id", body.unit_id);
    const { data: unitsData, error: unitsErr } = await unitsQuery;
    if (unitsErr) throw unitsErr;
    const units = (unitsData ?? []) as Unit[];

    const { data: ttgRows, error: ttgErr } = await admin
      .from("test_type_games")
      .select("test_type_id, game_id, games!inner(id, game_type, rules)")
      .in("test_type_id", testTypeIds)
      .eq("is_enabled", true);
    if (ttgErr) throw ttgErr;

    const gamesByTestType = new Map<string, Game[]>();
    for (const row of (ttgRows ?? []) as Array<{ test_type_id: string; games: Game }>) {
      const list = gamesByTestType.get(row.test_type_id) ?? [];
      list.push(row.games);
      gamesByTestType.set(row.test_type_id, list);
    }

    // Build candidate task list
    type Candidate = { unit: Unit; game: Game; testTypeCode: string };
    const allCandidates: Candidate[] = [];
    for (const unit of units) {
      const games = gamesByTestType.get(unit.test_type_id) ?? [];
      const testTypeCode = testTypeCodeById.get(unit.test_type_id) ?? "";
      for (const game of games) {
        if (!resolveGenerator(game.game_type)) continue;
        allCandidates.push({ unit, game, testTypeCode });
      }
    }

    // Filter to incomplete only
    let filtered: Candidate[] = allCandidates;
    let alreadyCompleteCount = 0;
    if (onlyIncomplete && allCandidates.length > 0) {
      const next: Candidate[] = [];
      const BATCH = 10;
      for (let i = 0; i < allCandidates.length; i += BATCH) {
        const slice = allCandidates.slice(i, i + BATCH);
        const flags = await Promise.all(
          slice.map((c) => isGameComplete(admin, c.unit, c.game).catch(() => false)),
        );
        slice.forEach((c, idx) => {
          if (flags[idx]) alreadyCompleteCount++;
          else next.push(c);
        });
      }
      filtered = next;
    }

    const queuedTasks: QueuedTask[] = filtered.map((c) => ({
      u: c.unit.id,
      g: c.game.id,
      t: c.testTypeCode,
    }));
    const totalGameTasks = queuedTasks.length;

    const { data: jobRow, error: jobErr } = await admin
      .from("generation_jobs")
      .insert({
        created_by: userId,
        test_type_code: body.test_type_code ?? null,
        scope_unit_id: body.unit_id ?? null,
        status: "running",
        total_tasks: totalGameTasks,
        pending_tasks: queuedTasks,
        task_errors: [],
      })
      .select("id")
      .single();
    if (jobErr || !jobRow) throw jobErr ?? new Error("Failed to create job row");
    const jobId = jobRow.id as string;

    log("Job created", {
      jobId,
      test_types: filteredTestTypes.map((t) => t.code),
      units: units.length,
      candidates: allCandidates.length,
      already_complete: alreadyCompleteCount,
      tasks: totalGameTasks,
      only_incomplete: onlyIncomplete,
      chunk_size: CHUNK_SIZE,
    });

    if (totalGameTasks === 0) {
      await admin
        .from("generation_jobs")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", jobId);
    } else {
      // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime
      EdgeRuntime.waitUntil(processChunk(jobId, authHeader, admin));
    }

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        message: onlyIncomplete
          ? "Background generation started for incomplete games only."
          : "Background generation started.",
        test_types: filteredTestTypes.map((t) => t.code),
        units: units.length,
        candidates: allCandidates.length,
        already_complete: alreadyCompleteCount,
        tasks: totalGameTasks,
        only_incomplete: onlyIncomplete,
        chunk_size: CHUNK_SIZE,
      }),
      {
        status: 202,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log(`ERROR`, { msg });
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
