// Démonstration hors ligne : les quatre états de l'interface, alimentés par
// des exécutions réelles enregistrées. Aucune requête réseau, aucune exécution.

const zone = document.querySelector("#zone");
const buttons = [...document.querySelectorAll("button[data-state]")];
const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);

let data = null;
let flaky = null;
// Un seul état animé à la fois : changer d'état annule la progression en cours.
let pendingTimer = null;

function cancelPending() {
  if (pendingTimer !== null) {
    clearInterval(pendingTimer);
    pendingTimer = null;
  }
}

async function load() {
  const [main, unstable] = await Promise.all([
    fetch("data/verdict.json").then((r) => r.json()),
    fetch("data/flaky.json").then((r) => r.json()),
  ]);
  data = main;
  flaky = unstable;
}

const ICONS = {
  good: '<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2.5 8.5l3.5 3.5 7-7.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  bad: '<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  warn: '<svg class="ico" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false"><path d="M8 2l6 11H2z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>',
};

function mark(ok, faulty) {
  if (faulty) return `<span class="mark bad">${ICONS.bad} échec — première bascule</span>`;
  return ok
    ? `<span class="mark good">${ICONS.good} passe</span>`
    : `<span class="mark bad">${ICONS.bad} échec</span>`;
}

function timeline(chain, verdict, limit) {
  const rows = chain.entries.slice(0, limit).map((entry) => {
    const run = verdict.results.find((result) => result.index === entry.index);
    const faulty = verdict.faultyIndex === entry.index;
    return `<li class="${faulty ? "faulty" : ""}"><span class="idx">#${entry.index}</span><span>${mark(run?.ok ?? true, faulty)}</span><code>${esc(entry.tree.slice(0, 10))}</code><span class="muted">${esc(entry.action)}</span></li>`;
  });
  return `<ol class="timeline">${rows.join("")}</ol>`;
}

function renderVide() {
  zone.className = "card";
  zone.innerHTML = `<h3>Aucune session capturée</h3>
    <p>Lancez une capture depuis votre agent : <code>rejeu capture --session &lt;id&gt;</code>, ou branchez le broker MCP.</p>
    <p class="muted">Trois dernières sessions locales (exemple) : <code>a41f9c2</code> · <code>9d0b7e1</code> · <code>flaky</code></p>`;
}

function renderChargement() {
  zone.className = "card";
  const total = data.chain.entries.length;
  zone.innerHTML = `<h3>Rejeu en cours</h3>
    <p id="prog">checkpoint 1/${total} — prédicat en cours…</p>
    <div class="bar" role="progressbar" aria-labelledby="prog" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="1"><span style="width:14%"></span></div>
    <p class="muted">Chaque checkpoint est extrait dans un répertoire jetable, réseau coupé, puis le prédicat y est réellement exécuté.</p>
    <button type="button" id="annuler">Annuler</button>`;
  cancelPending();
  let step = 1;
  const timer = setInterval(() => {
    step += 1;
    const bar = zone.querySelector(".bar > span");
    const label = zone.querySelector("#prog");
    const progress = zone.querySelector("[role=progressbar]");
    if (!bar || !label || !progress || step > total) {
      clearInterval(timer);
      pendingTimer = null;
      if (step > total) renderSucces();
      return;
    }
    label.textContent = `checkpoint ${step}/${total} — prédicat en cours…`;
    bar.style.width = `${Math.round((step / total) * 100)}%`;
    progress.setAttribute("aria-valuenow", String(step));
  }, 420);
  pendingTimer = timer;
  zone.querySelector("#annuler")?.addEventListener("click", () => {
    cancelPending();
    renderVide();
  });
}

function renderErreur() {
  const verdict = flaky.verdict;
  zone.className = "card warn";
  zone.innerHTML = `<h3><span aria-hidden="true">⚠</span> Verdict suspendu : prédicat non déterministe</h3>
    <p>${esc(verdict.message)}</p>
    <p class="muted">Rejeu exécute le prédicat plusieurs fois sur la même version : s'il ne se reproduit pas, il <strong>suspend</strong> le verdict au lieu de deviner. Cas enregistré réellement (${(verdict.durationMs / 1000).toFixed(1)} s).</p>
    <table><tr><th scope="row">Prédicat</th><td><code>${esc(flaky.predicate)}</code></td></tr>
    <tr><th scope="row">Rejoué</th><td>${verdict.checkpointsRun}/${verdict.checkpointsTotal}</td></tr>
    <tr><th scope="row">Dépôt hôte</th><td>${verdict.hostRepoUnchanged ? "intact" : "modifié"}</td></tr></table>`;
}

function renderSucces() {
  const verdict = data.verdict;
  zone.className = "card good";
  zone.innerHTML = `<h3>${ICONS.good} Itération fautive localisée</h3>
    <table>
      <tr><th scope="row">Itération fautive</th><td><strong>#${verdict.faultyIndex}</strong> (arbre <code>${esc(verdict.faultyTree?.slice(0, 10))}</code>)</td></tr>
      <tr><th scope="row">Prédécesseur</th><td>#${verdict.predecessorIndex}</td></tr>
      <tr><th scope="row">Prédicat</th><td><code>${esc(data.predicate)}</code></td></tr>
      <tr><th scope="row">Checkpoints rejoués</th><td>${verdict.checkpointsRun}/${verdict.checkpointsTotal} · dépôt hôte ${verdict.hostRepoUnchanged ? "intact" : "modifié"}</td></tr>
      <tr><th scope="row">Temps mesuré</th><td>${(verdict.durationMs / 1000).toFixed(1)} s</td></tr>
      <tr><th scope="row">Chaîne</th><td>${data.verification.ok ? `vérifiée ${data.verification.checked}/${data.verification.checked}` : "rompue"}</td></tr>
    </table>
    ${timeline(data.chain, verdict, 7)}
    <h4>Diff du checkpoint fautif vs son prédécesseur</h4>
    <pre>${esc(data.diff)}</pre>
    <p><a href="report.html">Ouvrir le rapport imprimable A4</a></p>`;
}

function select(name) {
  cancelPending();
  for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.state === name));
  if (name === "vide") renderVide();
  else if (name === "chargement") renderChargement();
  else if (name === "erreur") renderErreur();
  else renderSucces();
}

for (const button of buttons) button.addEventListener("click", () => select(button.dataset.state));

load()
  .then(() => select("vide"))
  .catch(() => {
    zone.className = "card bad";
    zone.innerHTML = `<h3>${ICONS.bad} Données de démonstration absentes</h3><p>La page a été ouverte hors du site publié : les fichiers <code>data/*.json</code> ne sont pas accessibles en <code>file://</code>. Le <a href="report.html">rapport imprimable</a> reste lisible.</p>';
  });
