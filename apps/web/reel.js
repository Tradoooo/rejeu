// Reel de démonstration : chaque texte affiché vient de fixtures/reel.json,
// lui-même produit par de vraies exécutions (scripts/capture-reel.mjs).
const reel = await fetch("data/reel.json").then((r) => r.json());

const scenes = [...document.querySelectorAll(".scene")];
const fill = (role, text) => {
  const node = document.querySelector(`[data-role="${role}"]`);
  if (node) node.textContent = text ?? "";
};

/** Terminal : le texte apparaît caractère par caractère (effet de frappe). */
async function type(node, text, speed = 14) {
  node.textContent = "";
  for (const [index, char] of [...text].entries()) {
    node.textContent += char;
    if (index % 4 === 0) await new Promise((done) => setTimeout(done, speed));
  }
}

function timeline(chain) {
  const rows = chain.map((entry, index) => {
    const faulty = index === 0;
    return `<li class="${faulty ? "faulty" : ""}"><span class="idx">#${index}</span><span class="mark ${faulty ? "bad" : "good"}">${faulty ? "✕ échec — première bascule" : "✓ passe"}</span><span>${entry.action}</span></li>`;
  });
  return rows.join("");
}

function stats(measures) {
  if (!measures) return "";
  const cells = [
    [`${measures.correct}/${measures.sessions}`, "localisations correctes"],
    [`${measures.medianSeconds.toFixed(2).replace(".", ",")} s`, "temps médian par session"],
    [`${measures.replayed}/${measures.checkpoints}`, "checkpoints rejoués"],
    ["0", "violation axe"],
  ];
  return cells.map(([value, label]) => `<div class="stat"><b>${value}</b><span>${label}</span></div>`).join("");
}

async function show(index) {
  for (const scene of scenes) scene.classList.remove("on");
  const scene = scenes[index];
  if (!scene) return;
  scene.classList.add("on");
  const role = (name) => scene.querySelector(`[data-role="${name}"]`);
  if (role("diff")) await type(role("diff"), reel.problem.diff, 4);
  if (role("redtest")) await type(role("redtest"), reel.problem.redTest, 3);
  if (role("commits")) await type(role("commits"), reel.problem.commitList, 10);
  if (role("chain")) await type(role("chain"), reel.capture.chain, 6);
  if (role("verify")) await type(role("verify"), reel.capture.verify, 8);
  if (role("find")) await type(role("find"), reel.find.stdout, 8);
  if (role("hook")) await type(role("hook"), reel.hook.stderr, 8);
  if (role("timeline")) role("timeline").innerHTML = timeline(reel.capture.chain ? JSON.parse(reel.capture.chain) : []);
  if (role("stats")) role("stats").innerHTML = stats(reel.measures);
}

const DURATIONS = [5200, 9000, 7000, 7000, 5200, 6000, 7000, 5200, 5200];
let index = 0;
await show(index);
while (index < scenes.length) {
  await new Promise((done) => setTimeout(done, DURATIONS[index] ?? 5000));
  index += 1;
  await show(index);
}
