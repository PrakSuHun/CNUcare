// 경량 마크다운 → 안전한 HTML. AI 답변의 표/굵게/목록/제목/코드를 렌더링.
// 입력을 먼저 이스케이프하므로 XSS 없음(우리 AI 출력 전용).
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 인라인: **굵게**, *기울임*, `코드`, [텍스트](url)
function inline(s: string): string {
  return s
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`]+)`/g, '<code class="mdc">$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener" class="mda">$1</a>');
}

function isTableSep(line: string): boolean {
  return /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(line);
}
function splitRow(line: string): string[] {
  return line.replace(/^\s*\|/, "").replace(/\|\s*$/, "").split("|").map((c) => c.trim());
}

export function renderMarkdown(input: string): string {
  const src = esc(String(input || "")).replace(/\r\n/g, "\n");
  const lines = src.split("\n");
  const out: string[] = [];
  let i = 0;
  let listType: "ul" | "ol" | null = null;
  const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

  while (i < lines.length) {
    const line = lines[i];

    // 표: 헤더행 + 구분행
    if (line.includes("|") && i + 1 < lines.length && isTableSep(lines[i + 1])) {
      closeList();
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim() !== "") {
        rows.push(splitRow(lines[i])); i++;
      }
      let t = '<div class="mdtwrap"><table class="mdt"><thead><tr>';
      t += header.map((h) => `<th>${inline(h)}</th>`).join("");
      t += "</tr></thead><tbody>";
      for (const r of rows) {
        t += "<tr>" + header.map((_, k) => `<td>${inline(r[k] ?? "")}</td>`).join("") + "</tr>";
      }
      t += "</tbody></table></div>";
      out.push(t);
      continue;
    }

    // 제목
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) { closeList(); const lv = Math.min(h[1].length + 1, 6); out.push(`<h${lv} class="mdh">${inline(h[2])}</h${lv}>`); i++; continue; }

    // 순서 목록
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) { if (listType !== "ol") { closeList(); out.push('<ol class="mdol">'); listType = "ol"; } out.push(`<li>${inline(ol[1])}</li>`); i++; continue; }

    // 불릿 목록
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    if (ul) { if (listType !== "ul") { closeList(); out.push('<ul class="mdul">'); listType = "ul"; } out.push(`<li>${inline(ul[1])}</li>`); i++; continue; }

    // 빈 줄
    if (line.trim() === "") { closeList(); out.push(""); i++; continue; }

    // 일반 문단
    closeList();
    out.push(`<div>${inline(line)}</div>`);
    i++;
  }
  closeList();
  return out.join("\n");
}
