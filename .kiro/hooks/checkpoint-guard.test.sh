#!/usr/bin/env bash
# Preuve exécutable : le hook bloque, et il laisse passer le reste.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
fail=0

check() {
  expected="$1"; payload="$2"; label="$3"
  printf '%s' "$payload" | "$here/checkpoint-guard.sh" >/dev/null 2>&1
  actual=$?
  if [ "$actual" -ne "$expected" ]; then
    echo "✕ $label : attendu $expected, obtenu $actual"
    fail=1
  else
    echo "✓ $label"
  fi
}

check 2 '{"command":"git commit --amend --no-edit"}'            "bloque git commit --amend"
check 2 '{"arguments":{"command":"git reset --hard HEAD~1"}}'   "bloque git reset --hard"
check 2 '{"command":"git checkout -- ."}'                        "bloque git checkout -- ."
check 0 '{"command":"git commit -m \"correctif\""}'              "laisse passer un commit normal"
check 0 '{"command":"pnpm test"}'                                "laisse passer un test"
check 0 '{"path":"src/a.ts"}'                                    "ignore un appel sans commande"
exit "$fail"
