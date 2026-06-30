// Orchestrator: generate all questions/passages/vocabulary for every unit
// across one test type (or all). Runs in the background after returning.
//
// Body: { test_type_code?: string, unit_id?: string }
// Writes progress to public.generation_jobs (subscribed via realtime by the admin UI).

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

const log = (msg: string, extra?: unknown) => {
  const tail = extra !== undefined ? ` ${JSON.stringify(extra)}` : "";
  console.log(`[GENERATE-ALL] ${msg}${tail}`);
};

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
 * Returns true if the given (unit, game) already meets its content requirement
 * and should be skipped when only_incomplete=true. Mirrors the logic used in
 * AdminContentStats.fetchStats so the background job aligns with the UI.
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

  // Flashcards: one approved/pending vocab entry per unique unit word
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
      const hasNonRejected = matches.some((m) => m.review_status !== "rejected");
      if (hasNonRejected) nonRejectedUnique++;
    }
    return nonRejectedUnique >= totalWords;
  }

  // Passage-based games
  if (game.game_type === "reading" || game.game_type === "linked_extracts" || game.game_type === "gap_fill_passage") {
    const passagesPerGame = Number(rules.passages_per_game ?? 3);
    const questionsPerPassage = Number(rules.questions_per_passage ?? 10);

    let passageQuery = admin
      .from("reading_passages")
      .select("id, review_status, title")
      .eq("unit_id", unit.id);

    const { data: allPassagesRaw } = await passageQuery;
    let allPassages = (allPassagesRaw ?? []) as Array<{ id: string; review_status: string | null; title: string | null }>;

    // Apply title prefix filters in JS (Supabase JS doesn't support .or with .not chains cleanly here)
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
      if (!q.passage_id) continue;
      if (q.review_status === "rejected") continue;
      byPassage.set(q.passage_id, (byPassage.get(q.passage_id) ?? 0) + 1);
    }

    let validCount = 0;
    for (const p of allPassages) {
      if (p.review_status === "rejected") continue;
      if ((byPassage.get(p.id) ?? 0) >= questionsPerPassage) validCount++;
    }
    return validCount >= passagesPerGame;
  }

  // Word/question-based games (context_master, cloze_challenge)
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
    // Word-based: only count questions whose word is currently in the unit
    const inUnit = all.filter((q) => q.word && lowerWords.has(q.word.toLowerCase()));
    const nonRejected = inUnit.filter((q) => q.review_status !== "rejected").length;
    return nonRejected >= required;
  }

  // Unknown game type — treat as complete (skip)
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

type Task = { unit: Unit; game: Game; testTypeCode: string };

async function runGeneration(
  jobId: string,
  tasks: Task[],
  authHeader: string,
  admin: ReturnType<typeof createClient>,
) {
  let success = 0;
  let skipped = 0;
  let failed = 0;
  const startedAt = Date.now();

  const updateJob = async (patch: Record<string, unknown>) => {
    try {
      await admin.from("generation_jobs").update(patch).eq("id", jobId);
    } catch (e) {
      log("Failed to update job", { jobId, e: String(e) });
    }
  };

  try {
    for (const { unit, game, testTypeCode } of tasks) {
      const words = Array.isArray(unit.words) ? unit.words : [];
      if (words.length === 0) continue;
      const gen = resolveGenerator(game.game_type);
      if (!gen) continue;

      await updateJob({
        current_label: `${testTypeCode} • ${unit.title} • ${game.game_type}`,
      });

      let payload: Record<string, unknown>;
      if (gen.fn === "generate-vocabulary") {
        payload = { unit_id: unit.id, words };
      } else if (gen.fn === "generate-test-questions") {
        payload = {
          unit_id: unit.id,
          words,
          game_type: game.game_type,
          game_id: game.id,
          test_type_code: testTypeCode,
        };
      } else {
        payload = {
          unit_id: unit.id,
          words,
          test_type_code: testTypeCode,
          unit_title: unit.title,
        };
      }

      const iterations = gen.isPassage ? MAX_PASSAGE_ITERATIONS : 1;
      for (let i = 0; i < iterations; i++) {
        try {
          const result = await invokeChild(gen.fn, payload, authHeader);
          if (!result.ok) {
            failed++;
            log(`FAIL ${gen.fn}`, {
              unit: unit.title,
              game: game.game_type,
              status: result.status,
              body: result.body,
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
        } catch (err) {
          failed++;
          log(`ERR ${gen.fn}`, {
            unit: unit.title,
            game: game.game_type,
            error: String(err),
          });
          break;
        }
      }

      await updateJob({
        success_count: success,
        skipped_count: skipped,
        failed_count: failed,
      });
    }

    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    log(`Done`, { success, skipped, failed, elapsed_seconds: elapsed });
    await updateJob({
      status: "completed",
      success_count: success,
      skipped_count: skipped,
      failed_count: failed,
      current_label: null,
      finished_at: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Job crashed", { msg });
    await updateJob({
      status: "failed",
      error_message: msg,
      success_count: success,
      skipped_count: skipped,
      failed_count: failed,
      current_label: null,
      finished_at: new Date().toISOString(),
    });
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
    };

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
    for (const row of (ttgRows ?? []) as Array<{
      test_type_id: string;
      games: Game;
    }>) {
      const list = gamesByTestType.get(row.test_type_id) ?? [];
      list.push(row.games);
      gamesByTestType.set(row.test_type_id, list);
    }

    const totalGameTasks = units.reduce((acc, u) => {
      const games = gamesByTestType.get(u.test_type_id) ?? [];
      return acc + games.filter((g) => resolveGenerator(g.game_type)).length;
    }, 0);

    const { data: jobRow, error: jobErr } = await admin
      .from("generation_jobs")
      .insert({
        created_by: userId,
        test_type_code: body.test_type_code ?? null,
        scope_unit_id: body.unit_id ?? null,
        status: "running",
        total_tasks: totalGameTasks,
      })
      .select("id")
      .single();
    if (jobErr || !jobRow) throw jobErr ?? new Error("Failed to create job row");
    const jobId = jobRow.id as string;

    log("Job created", {
      jobId,
      test_types: filteredTestTypes.map((t) => t.code),
      units: units.length,
      tasks: totalGameTasks,
    });

    // @ts-ignore EdgeRuntime is provided by Supabase Edge runtime
    EdgeRuntime.waitUntil(
      runGeneration(jobId, units, gamesByTestType, testTypeCodeById, authHeader, admin),
    );

    return new Response(
      JSON.stringify({
        success: true,
        job_id: jobId,
        message: "Generation started in background.",
        test_types: filteredTestTypes.map((t) => t.code),
        units: units.length,
        tasks: totalGameTasks,
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
