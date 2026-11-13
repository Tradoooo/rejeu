/**
 * Mesure la FRÉQUENCE du problème sur les dépôts réels de l'organisation.
 *
 * Ce qui est compté : parmi les PRs mergées, combien l'ont été **à un seul
 * commit** (fusion squash/rebase : les commits intermédiaires de l'agent
 * disparaissent de l'historique) et combien avaient **plusieurs commits**
 * avant la fusion (donc des itérations qui ont existé puis ont été effacées).
 *
 * Source : GitHub GraphQL (API de l'organisation). Aucune estimation.
 *
 * Usage : node scripts/measure-frequency.mjs [organisation]
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const ORG = process.argv[2] ?? "Tradoooo";
const REPOS = ["comptoir", "galons", "echeance", "sas", "creux", "vision", "testt", "duello_kotlin", "veille", "vigie"];

const QUERY = `query($repo:String!){
  repository(owner:"${ORG}", name:$repo){
    pullRequests(states:[MERGED], first:100, orderBy:{field:UPDATED_AT,direction:DESC}){
      nodes { commits{totalCount} mergeCommit{ parents{totalCount} } }
    }
  }
}`;

function count(repo) {
  const result = spawnSync("gh", ["api", "graphql", "-f", `query=${QUERY}`, "-f", `repo=${repo}`], { encoding: "utf8" });
  if (result.status !== 0) return null;
  try {
    const data = JSON.parse(result.stdout).data.repository.pullRequests.nodes;
    return {
      repo,
      merged: data.length,
      squashed: data.filter((pr) => pr.mergeCommit && pr.mergeCommit.parents.totalCount === 1).length,
      multiCommit: data.filter((pr) => pr.commits.totalCount > 1).length,
    };
  } catch {
    return null;
  }
}

const rows = REPOS.map(count).filter(Boolean);
const merged = rows.reduce((sum, row) => sum + row.merged, 0);
const squashed = rows.reduce((sum, row) => sum + row.squashed, 0);
const multi = rows.reduce((sum, row) => sum + row.multiCommit, 0);
const report = {
  measuredAt: new Date().toISOString(),
  organisation: ORG,
  sample: "PRs mergées, 100 plus récentes par dépôt",
  rows,
  total: { merged, squashed, multiCommit: multi },
  ratios: {
    squashedPercent: Number(((squashed / merged) * 100).toFixed(1)),
    multiCommitPercent: Number(((multi / merged) * 100).toFixed(1)),
    erasedPercent: Number(((multi / merged) * 100).toFixed(1)),
  },
  note: "« multiCommit » = la PR avait plusieurs commits avant la fusion : l'agent avait itéré. « squashed » = fusion à un seul commit : ces itérations ont été effacées de l'historique.",
};
mkdirSync(resolve("docs/preuves"), { recursive: true });
writeFileSync(resolve("docs/preuves/frequence.json"), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
