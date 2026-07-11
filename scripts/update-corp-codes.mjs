// DART corpCode.xml을 내려받아 lib/data/corpCodes.json을 갱신한다.
// 실행: DART_API_KEY=xxx node scripts/update-corp-codes.mjs
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";

const apiKey = process.env.DART_API_KEY;
if (!apiKey) {
  console.error("DART_API_KEY 환경변수가 필요합니다.");
  process.exit(1);
}

const res = await fetch(`https://opendart.fss.or.kr/api/corpCode.xml?crtfc_key=${apiKey}`);
if (!res.ok) {
  console.error(`corpCode.xml 요청 실패 (HTTP ${res.status})`);
  process.exit(1);
}
const buf = Buffer.from(await res.arrayBuffer());
const zip = await JSZip.loadAsync(buf);
const xmlFile = zip.file("CORPCODE.xml");
if (!xmlFile) {
  console.error("CORPCODE.xml을 zip에서 찾을 수 없습니다.");
  process.exit(1);
}
const xmlText = await xmlFile.async("text");

const parser = new XMLParser({ parseTagValue: false });
const parsed = parser.parse(xmlText);
const items = parsed?.result?.list ?? [];
const list = (Array.isArray(items) ? items : [items]).map((item) => ({
  corp_code: String(item.corp_code ?? "").trim(),
  corp_name: String(item.corp_name ?? "").trim(),
  stock_code: String(item.stock_code ?? "").trim(),
}));

const outPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "lib", "data", "corpCodes.json");
writeFileSync(outPath, JSON.stringify(list));
console.log(`${list.length}개 회사 코드 저장 완료: ${outPath}`);
