/**
 * Site local de la recette, pour les scénarios qui simulent un dépôt de trace sur le Drive (jamais sur le vrai site).
 *
 * Chaîne reproduite, la même qu'en production : Drive → traitement des GPX → application publiée.
 *  - le Drive est un MOCK : un dossier de fichiers GPX (`outputs/local-site/drive/`), au départ copie des fichiers de
 *    test de l'application (`test-gpx-files/`, qui reflètent le dossier Drive de test) ;
 *  - le traitement est celui de l'application (`scripts/process-gpx.js`, client Drive remplacé par le mock : aucun
 *    identifiant, aucun accès réseau) ;
 *  - l'application est construite avec son propre webpack (cache : reconstruite seulement si ses sources changent)
 *    puis servie en HTTP local, sur le port libre choisi par le système.
 *
 * Prérequis : dépendances de l'application installées à la racine du dépôt (`npm ci` à la racine).
 * Tout est écrit sous `outputs/local-site/` (gitignoré).
 */
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { copyFileSync, createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';

const RECETTE_DIR = fileURLToPath(new URL('../../../', import.meta.url));
const REPO_ROOT = path.resolve(RECETTE_DIR, '..');
const WORK = path.join(RECETTE_DIR, 'outputs', 'local-site');
const DRIVE = path.join(WORK, 'drive');
const DIST = path.join(WORK, 'dist');
// Emplacement des données, relatif à la racine du dépôt (webpack le copie tel quel dans dist/ et l'application le lit).
const DATA_REL = path.relative(REPO_ROOT, path.join(WORK, 'data')).split(path.sep).join('/');
const SRC_GPX = path.join(REPO_ROOT, DATA_REL, 'gpx');
const SRC_TRACES = path.join(REPO_ROOT, DATA_REL, 'traces', 'traces.json');
const DIST_GPX = path.join(DIST, DATA_REL, 'gpx');
const DIST_TRACES = path.join(DIST, DATA_REL, 'traces', 'traces.json');
const SOURCES_WATCHED = ['scripts/map.js', 'scripts/map-utils.js', 'index.html', 'styles.css', 'webpack.config.js'];
const CONTENT_TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.gpx': 'application/gpx+xml' };

/** Trace fictive « déposée » sur le Drive simulé par les scénarios (nom = nom du fichier sans extension). */
export const DROPPED_TRACE = {
  file: fileURLToPath(new URL('../fixtures/Parcours - 12km - Boucle de recette.gpx', import.meta.url)),
  name: 'Parcours - 12km - Boucle de recette',
};

/** Fait taire les journaux du traitement des GPX (liste de fichiers, coordonnées) pendant `fn`. */
async function quiet(fn) {
  const { log, error } = console;
  console.log = () => {};
  console.error = () => {};
  try { return await fn(); } finally { console.log = log; console.error = error; }
}

/** Client Drive simulé : liste et lit les fichiers d'un dossier local (même forme que le client googleapis). */
function createFolderDriveMock(dir) {
  return {
    files: {
      list: async () => ({ data: { files: readdirSync(dir).filter((n) => n.endsWith('.gpx')).map((n) => ({ id: n, name: n })) } }),
      get: async ({ fileId }) => ({ data: createReadStream(path.join(dir, fileId)) }),
    },
  };
}

/** Traitement de l'application, branché sur le Drive simulé : GPX nettoyés dans `gpxDir`, `traces.json` écrit. */
async function processDrive(gpxDir, tracesFile) {
  if (!existsSync(path.join(REPO_ROOT, 'node_modules'))) {
    throw new Error("Dépendances de l'application absentes : lancer « npm ci » à la racine du dépôt avant ce scénario.");
  }
  const appRequire = createRequire(path.join(REPO_ROOT, 'index.js'));
  const { processGpxFiles, setDriveClient } = appRequire('./scripts/process-gpx.js');
  mkdirSync(gpxDir, { recursive: true });
  mkdirSync(path.dirname(tracesFile), { recursive: true });
  setDriveClient(createFolderDriveMock(DRIVE));
  try {
    await quiet(() => processGpxFiles(gpxDir, tracesFile));
  } finally {
    setDriveClient(undefined);
  }
}

/** Remet le Drive simulé dans son état de départ : les fichiers de test de l'application. */
function resetDrive() {
  rmSync(DRIVE, { recursive: true, force: true });
  mkdirSync(DRIVE, { recursive: true });
  const refDir = path.join(REPO_ROOT, 'test-gpx-files');
  for (const name of readdirSync(refDir).filter((n) => n.endsWith('.gpx'))) copyFileSync(path.join(refDir, name), path.join(DRIVE, name));
}

function needsBuild() {
  const bundle = path.join(DIST, 'main.js');
  if (!existsSync(bundle) || !existsSync(DIST_TRACES)) return true;
  const builtAt = statSync(bundle).mtimeMs;
  return SOURCES_WATCHED.some((f) => statSync(path.join(REPO_ROOT, f)).mtimeMs > builtAt);
}

let buildPromise = null;
let sharedServer = null;

/** Construit l'application une seule fois par exécution du runner (et pas du tout si rien n'a changé). */
function ensureBuilt() {
  buildPromise ??= (async () => {
    if (!needsBuild()) return;
    resetDrive();
    // webpack copie les données dans dist/ : elles doivent exister au moment du build.
    await processDrive(SRC_GPX, SRC_TRACES);
    rmSync(DIST, { recursive: true, force: true });
    try {
      execFileSync(path.join(REPO_ROOT, 'node_modules', '.bin', 'webpack'),
        ['--config', 'webpack.config.js', '--output-path', DIST],
        { cwd: REPO_ROOT, env: { ...process.env, GPX_FILES_DIR: `${DATA_REL}/gpx`, TRACES_FILE_PATH: `${DATA_REL}/traces/traces.json` }, stdio: 'pipe', timeout: 240000 });
    } catch (err) {
      mkdirSync(WORK, { recursive: true });
      writeFileSync(path.join(WORK, 'build.log'), `${err.stdout ?? ''}\n${err.stderr ?? ''}`, 'utf8');
      throw new Error("Build de l'application impossible (détail : outputs/local-site/build.log).");
    }
  })();
  buildPromise.catch(() => { buildPromise = null; });
  return buildPromise;
}

/** Serveur HTTP statique de l'application construite, sur un port libre de l'interface locale. */
function serveDist() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let filePath = path.join(DIST, urlPath);
    if (!filePath.startsWith(DIST)) { res.writeHead(403).end(); return; }
    if (existsSync(filePath) && statSync(filePath).isDirectory()) filePath = path.join(filePath, 'index.html');
    if (!existsSync(filePath)) { res.writeHead(404).end(); return; }
    // Pas de cache : la page doit toujours voir les données les plus récentes après un nouveau traitement.
    res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(filePath)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/**
 * Démarre le site local dans son état de départ (Drive simulé = fichiers de test), et retourne :
 *  - `url` : adresse du site ;
 *  - `traces()` : traces actuellement publiées (contenu de `traces.json`) ;
 *  - `dropOnDrive(fixturePath)` : dépose un fichier GPX dans le Drive simulé ;
 *  - `publish()` : relance le traitement (Drive → traces publiées), comme le fait la publication de l'application ;
 *  - `stop()` : arrête le serveur.
 */
export async function startLocalSite() {
  await ensureBuilt();
  resetDrive();
  await processDrive(DIST_GPX, DIST_TRACES);
  // Un seul serveur par exécution, donc une adresse stable : la session réutilise la même fenêtre pour tous les scénarios locaux.
  if (!sharedServer) {
    sharedServer = await serveDist();
    sharedServer.unref(); // ne retient pas la fin du processus du runner
  }
  const server = sharedServer;
  const readTraces = () => JSON.parse(readFileSync(DIST_TRACES, 'utf8')).traces;
  return {
    // Nom d'hôte « localhost » (et non l'adresse IP) : c'est lui que le contrôle des hôtes autorisés reconnaît.
    url: `http://localhost:${server.address().port}/`,
    traces: readTraces,
    dropOnDrive: (fixturePath) => copyFileSync(fixturePath, path.join(DRIVE, path.basename(fixturePath))),
    publish: () => processDrive(DIST_GPX, DIST_TRACES),
    // Le serveur reste actif pour les scénarios suivants ; il s'arrête avec le processus du runner.
    stop: async () => {},
  };
}
