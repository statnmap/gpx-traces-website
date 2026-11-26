#!/usr/bin/env node
// Garde-fou du pre-commit : détecte une corruption typique d'un remplacement de texte (JavaScript ou sed avec `$` / `&`
// dans le texte remplaçant) : le début du fichier est copié plus bas dans le même fichier.
// Contrôle les fichiers .md stagés (contenu de l'index). Un bloc de tête qui réapparaît à l'identique plus loin bloque le
// commit. On compare les lignes 2 à 6 (pas la 1re) : la copie insérée est souvent collée au milieu d'une ligne, ce qui
// altère sa première ligne mais pas les suivantes. Exception volontaire : `<!-- doublon-entete: ok -->` dans le fichier.
import { execFileSync } from 'node:child_process';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 });
const IGNORE = '<!-- doublon-entete: ok -->';
const BLOC = 5;

let fichiers = [];
try {
  fichiers = git('diff', '--cached', '--name-only', '--diff-filter=AM').split('\n').filter((f) => f.endsWith('.md'));
} catch {
  process.exit(0); // pas un dépôt git : rien à contrôler
}

let echec = false;
for (const f of fichiers) {
  let texte;
  try { texte = git('show', `:${f}`); } catch { continue; }
  if (texte.includes(IGNORE)) continue;
  const lignes = texte.split('\n');
  if (lignes.length < 10) continue;
  const tete = lignes.slice(1, 1 + BLOC);
  if (tete.filter((l) => l.trim()).length < 3) continue;
  for (let i = BLOC + 3; i <= lignes.length - BLOC; i++) {
    if (tete.every((l, k) => lignes[i + k] === l)) {
      console.error(`❌ ERREUR : début de fichier répété dans ${f} (ligne ${i + 1}) — probable corruption par un remplacement de texte contenant « $ » ou « & ».`);
      console.error(`   Comparer avec la version précédente : git diff --cached --stat -- ${f}`);
      console.error(`   Si la répétition est voulue : ajouter la ligne ${IGNORE} dans le fichier.`);
      echec = true;
      break;
    }
  }
}
process.exit(echec ? 1 : 0);
