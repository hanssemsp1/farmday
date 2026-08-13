// 로컬 도구(farmday-studio/manager)에 모아둔 상품을 사이트로 옮긴다.
// 실행: node scripts/import-plans.mjs
//   관리자 계정으로 로그인한 뒤 넣는다 — 이 표는 관리자만 쓸 수 있게 잠겨 있다.
import fs from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const DB = "C:/Users/서현주/OneDrive/Desktop/Agent/farmday-studio/products/db";

// .env 읽기 (dotenv 없이)
const env = Object.fromEntries(
  (await fs.readFile(new URL("../.env", import.meta.url), "utf8"))
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

const { error: authErr } = await supabase.auth.signInWithPassword({
  email: env.ADMIN_EMAIL,
  password: env.ADMIN_PASSWORD,
});
if (authErr) { console.error("관리자 로그인 실패:", authErr.message); process.exit(1); }
console.log(`관리자 로그인 완료 (${env.ADMIN_EMAIL})`);

const THUMB_KEYS = ["main", "sub1", "sub2", "sub3", "sub4"];
const DETAIL_NOS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

const files = (await fs.readdir(DB)).filter((f) => f.endsWith(".json"));
let ok = 0, fail = 0;

for (const f of files) {
  const p = JSON.parse(await fs.readFile(path.join(DB, f), "utf8"));

  // 빠진 칸을 채워 사이트 화면이 기대하는 모양으로 맞춘다
  const c = p.content || {};
  c.thumbs = c.thumbs || {};
  THUMB_KEYS.forEach((k) => { c.thumbs[k] = c.thumbs[k] || { kicker: "", hook: "" }; });
  c.details = c.details || {};
  DETAIL_NOS.forEach((n) => { if (c.details[n] == null) c.details[n] = ""; });
  c.badge = c.badge || "";
  c.notes = c.notes || [];

  const cp = p.coupang || {};
  const row = {
    id: p.id,
    category: p.category || null,
    season: p.season || [],
    status: p.status || "기획",
    vendor: p.vendor || { name: "", note: "" },
    coupang: {
      name: cp.name || "", category: cp.category || "", searchFilter: cp.searchFilter || "",
      tags: cp.tags || [], registerId: cp.registerId || "",
      optionRows: cp.optionRows || [], priceMemo: cp.priceMemo || "", optionIds: cp.optionIds || "",
    },
    options: p.options || [],
    competitors: p.competitors || { weights: [], rows: [] },
    content: c,
    reviews: p.reviews || [],
    assets: p.assets || { folder: "", preview: "" },
  };

  const { error } = await supabase.from("product_plans").upsert(row);
  if (error) { console.log(`  ✗ ${p.id} — ${error.message}`); fail++; }
  else { console.log(`  ✓ ${p.id.padEnd(14)} ${(p.category || "미분류").padEnd(4)} 옵션 ${(p.options || []).length}`); ok++; }
}

console.log(`\n${ok}개 옮김${fail ? `, ${fail}개 실패` : ""}`);
await supabase.auth.signOut();
