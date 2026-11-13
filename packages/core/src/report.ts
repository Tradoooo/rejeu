import type { Chain, FaultVerdict, VerifyResult } from "./types.ts";
import { sessionDigest } from "./chain.ts";

/** Échappement HTML minimal : le rapport ne rend que du texte, jamais de balise. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Icônes en SVG plutôt qu'en glyphes texte : axe ne peut pas mesurer le
 * contraste d'un caractère seul (« contenu non textuel »), il laissait donc
 * chaque icône en « non concluant ». En SVG, l'information reste portée par
 * le texte voisin (« passe », « échec ») et le contrôle de contraste conclut.
 */
export function icon(name: "good" | "bad" | "warn"): string {
  const paths = {
    good: '<path d="M2.5 8.5l3.5 3.5 7-7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
    bad: '<path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
    warn: '<path d="M8 2l6 11H2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M8 6v3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  };
  return `<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">${paths[name]}</svg>`;
}

const STATUS_LABEL: Record<FaultVerdict["status"], { text: string; icon: string; cls: string }> = {
  localise: { text: "Itération fautive localisée", icon: icon("bad"), cls: "bad" },
  aucun: { text: "Aucune bascule", icon: icon("good"), cls: "good" },
  "non-deterministe": { text: "Verdict suspendu (non déterministe)", icon: icon("warn"), cls: "warn" },
  erreur: { text: "Erreur de rejeu", icon: icon("bad"), cls: "bad" },
};

/** Icône + texte + classe : jamais la couleur seule (accessibilité). */
function statusMark(ok: boolean, isFaulty: boolean): string {
  if (isFaulty) return `<span class="mark bad">${icon("bad")} échec</span>`;
  return ok
    ? `<span class="mark good">${icon("good")} passe</span>`
    : `<span class="mark bad">${icon("bad")} échec</span>`;
}

export interface ReportInput {
  chain: Chain;
  verdict: FaultVerdict;
  verification: VerifyResult;
  generatedAt: string;
}

function timeline(chain: Chain, verdict: FaultVerdict): string {
  const rows = chain.entries.map((entry) => {
    const isFaulty = verdict.faultyIndex === entry.index;
    const ran = verdict.results.find((result) => result.index === entry.index);
    const state = ran
      ? statusMark(ran.ok, isFaulty)
      : `<span class="mark skip">${icon("warn")} non rejoué</span>`;
    const label = isFaulty ? " — première bascule" : "";
    return `<li class="${isFaulty ? "faulty" : ""}">
      <span class="idx">#${entry.index}</span>
      <span class="state">${state}${label}</span>
      <code class="tree">${escapeHtml(entry.tree.slice(0, 12))}</code>
      <span class="action">${escapeHtml(entry.tool)} · ${escapeHtml(entry.action)}</span>
      <time datetime="${escapeHtml(entry.at)}">${escapeHtml(entry.at)}</time>
    </li>`;
  });
  return `<ol class="timeline">${rows.join("\n")}</ol>`;
}

function chainBlock(verification: VerifyResult, digest: string): string {
  const head = verification.ok
    ? `<p class="good">${icon("good")} Chaîne vérifiée ${verification.checked}/${verification.checked}</p>`
    : `<p class="bad">${icon("bad")} Chaîne rompue : ${verification.breaks.length} rupture(s)</p>`;
  const list = verification.breaks
    .map((b) => `<li>#${b.index} — ${escapeHtml(b.reason)} (attendu ${escapeHtml(b.expected.slice(0, 12))}, trouvé ${escapeHtml(b.found.slice(0, 12))})</li>`)
    .join("");
  const details = verification.breaks.length > 0 ? `<ul>${list}</ul>` : "";
  return `${head}${details}<p class="muted">Empreinte de session <code>${escapeHtml(digest)}</code></p>`;
}

const STYLE = `
:root{--fg:#12161c;--bg:#fbfaf7;--muted:#5a6472;--line:#d9d5cc;--good:#1c6b3f;--bad:#9b1c1c;--bad-soft:#fbe9e9;--warn:#7a4b00;--accent:#2b4b7a}
@media (prefers-color-scheme:dark){:root{--fg:#eceae4;--bg:#12161c;--muted:#a8b0bb;--line:#2c3440;--good:#7fd1a3;--bad:#ff9b9b;--bad-soft:#2a1518;--warn:#ffcf7a;--accent:#9dbbe6}}
*{box-sizing:border-box}
body{margin:0;padding:2rem;background:var(--bg);color:var(--fg);font:16px/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:52rem;margin:0 auto}
h1{font-size:1.6rem;margin:0 0 .25rem}
h2{font-size:1.05rem;margin:2rem 0 .5rem;border-bottom:1px solid var(--line);padding-bottom:.25rem}
.muted{color:var(--muted)}
code{font:14px/1.4 ui-monospace,SFMono-Regular,Menlo,monospace}
.verdict{border:2px solid var(--line);border-left:8px solid var(--accent);padding:1rem;margin:1rem 0}
.verdict.bad{border-left-color:var(--bad)}
.verdict.good{border-left-color:var(--good)}
.verdict.warn{border-left-color:var(--warn)}
.timeline{list-style:none;padding:0;margin:0}
.timeline li{display:grid;grid-template-columns:3.2rem 9rem 8rem 1fr auto;gap:.5rem;align-items:baseline;padding:.45rem .25rem;border-bottom:1px solid var(--line)}
.timeline li.faulty{background:var(--bad-soft);outline:2px solid var(--bad);outline-offset:-2px}
.idx{font-weight:700}
.mark{white-space:nowrap;display:inline-flex;align-items:center;gap:.3rem}
.ico{display:inline-block;vertical-align:-2px}
.mark.good{color:var(--good)}
.mark.bad{color:var(--bad);font-weight:700}
.mark.skip,.mark.warn{color:var(--warn)}
.good{color:var(--good)}
.bad{color:var(--bad)}
.warn{color:var(--warn)}
table{border-collapse:collapse;width:100%}
th,td{text-align:left;padding:.35rem .5rem;border-bottom:1px solid var(--line);vertical-align:top}
@media (prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
@media print{body{padding:0;font-size:11pt}a{color:inherit;text-decoration:none}.timeline li{break-inside:avoid}}
:focus-visible{outline:3px solid var(--accent);outline-offset:2px}
`;

/** Rapport HTML autonome : aucune requête réseau, imprimable A4. */
export function renderReport(input: ReportInput): string {
  const { chain, verdict, verification, generatedAt } = input;
  const status = STATUS_LABEL[verdict.status];
  const fault = verdict.faultyIndex === null ? "—" : `#${verdict.faultyIndex}`;
  return `<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Rejeu — session ${escapeHtml(chain.session)} · ${escapeHtml(status.text)}</title>
<style>${STYLE}</style>
</head>
<body>
<main>
  <h1>Rejeu — rapport de rejeu</h1>
  <p class="muted">Session <code>${escapeHtml(chain.session)}</code> · ${chain.entries.length} checkpoints · généré le <time datetime="${escapeHtml(generatedAt)}">${escapeHtml(generatedAt)}</time></p>

  <section class="verdict ${status.cls}" aria-labelledby="verdict-title">
    <h2 id="verdict-title"><span aria-hidden="true">${status.icon}</span> ${escapeHtml(status.text)}</h2>
    <p>${escapeHtml(verdict.message)}</p>
    <table>
      <tr><th scope="row">Itération fautive</th><td>${escapeHtml(fault)}</td></tr>
      <tr><th scope="row">Arbre</th><td><code>${escapeHtml(verdict.faultyTree?.slice(0, 12) ?? "—")}</code></td></tr>
      <tr><th scope="row">Prédécesseur</th><td>${verdict.predecessorIndex === null ? "—" : `#${verdict.predecessorIndex}`}</td></tr>
      <tr><th scope="row">Prédicat</th><td><code>${escapeHtml(verdict.predicate)}</code></td></tr>
      <tr><th scope="row">Checkpoints rejoués</th><td>${verdict.checkpointsRun}/${verdict.checkpointsTotal} · réseau ${verdict.hostRepoUnchanged ? "hôte intact" : "HÔTE MODIFIÉ"}</td></tr>
      <tr><th scope="row">Durée</th><td>${(verdict.durationMs / 1000).toFixed(1)} s · mode ${escapeHtml(verdict.mode)}</td></tr>
    </table>
  </section>

  <h2>Timeline des checkpoints</h2>
  ${timeline(chain, verdict)}

  <h2>Chaîne d'attestation</h2>
  ${chainBlock(verification, sessionDigest(chain))}

  <h2>Limites</h2>
  <p class="muted">Rejeu localise la version fautive ; il ne dit pas si le correctif est bon. Un test non déterministe suspend le verdict au lieu de deviner. Seuls les appels passés par le broker sont capturés.</p>
</main>
</body>
</html>
`;
}
