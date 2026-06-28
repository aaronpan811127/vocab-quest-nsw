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

async function runGeneration(
  jobId: string,
  units: Unit[],
  gamesByTestType: Map<string, Game[]>,
  testTypeCodeById: Map<string, string>,
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
    for (const unit of units) {
      const games = gamesByTestType.get(unit.test_type_id) ?? [];
      const testTypeCode = testTypeCodeById.get(unit.test_type_id) ?? "";
      const words = Array.isArray(unit.words) ? unit.words : [];
      if (words.length === 0) continue;

      for (const game of games) {
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
