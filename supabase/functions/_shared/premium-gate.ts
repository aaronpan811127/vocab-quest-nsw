// Shared premium/trial gate for content-generation edge functions.
// Free trial: only first 2 units per test_type are accessible.
// Premium/admin/trial-active users: full access.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export async function assertPremiumForUnit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  unitId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const { data: unitRow, error: unitErr } = await supabase
    .from("units")
    .select("unit_number, test_type_id")
    .eq("id", unitId)
    .single();
  if (unitErr || !unitRow) {
    return { ok: false, status: 400, error: "Invalid unit" };
  }

  const { data: premiumFlag, error: rpcErr } = await supabase.rpc(
    "has_premium_access",
    { _user_id: userId },
  );
  if (rpcErr) {
    console.error("has_premium_access rpc error:", rpcErr);
    return { ok: false, status: 500, error: "Failed to verify access" };
  }
  if (premiumFlag === true) return { ok: true };

  const { count, error: countErr } = await supabase
    .from("units")
    .select("id", { count: "exact", head: true })
    .eq("test_type_id", (unitRow as any).test_type_id)
    .lte("unit_number", (unitRow as any).unit_number);
  if (countErr) {
    console.error("unit index count error:", countErr);
    return { ok: false, status: 500, error: "Failed to verify access" };
  }
  if ((count ?? 0) > 2) {
    return {
      ok: false,
      status: 403,
      error: "Premium subscription required to generate content for this unit.",
    };
  }
  return { ok: true };
}
