#!/usr/bin/env bash
# checkpoint-guard — hook avant outil (Kiro / hook générique).
#
# Refuse les commandes qui détruisent l'historique pendant une session
# capturée : un `amend`, un `reset --hard` ou un `checkout -- .` efface
# l'arbre d'un checkpoint déjà écrit, et le verdict devient faux.
#
# Entrée : JSON sur stdin (champ `command` ou `arguments.command`).
# Sortie : 0 = autorisé, 2 = bloqué avec un message sur stderr.
set -u
payload="$(cat)"
# Extraction non gloutonne : on s'arrête à la première guillemet fermant.
command_text="$(printf '%s' "$payload" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)"
if [ -z "$command_text" ]; then
  exit 0
fi
case "$command_text" in
  *"commit --amend"*|*"reset --hard"*|*"checkout -- ."*|*"filter-branch"*)
    echo "checkpoint-guard : « $command_text » réécrit l'historique d'une session capturée." >&2
    echo "Un checkpoint déjà écrit ne doit pas être invalidé : utilisez un commit de correction." >&2
    exit 2
    ;;
esac
exit 0
