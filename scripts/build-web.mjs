import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const requiredFields = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
const allowedFields = new Set([...requiredFields, 'measurementId']);

export function validateWebConfig(target, env, productionProjectId) {
  if (!['staging', 'production'].includes(target)) {
    throw new Error('El entorno debe ser staging o production.');
  }
  if (!/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(productionProjectId ?? '')) {
    throw new Error('Configura projects.production en .firebaserc.');
  }
  const projectId = env.FIREBASE_PROJECT_ID;
  if (typeof projectId !== 'string' || !/^[a-z][a-z0-9-]{4,28}[a-z0-9]$/.test(projectId)) {
    throw new Error('FIREBASE_PROJECT_ID es obligatorio y debe ser un ID de proyecto Firebase.');
  }
  if (target === 'staging' && projectId === productionProjectId) {
    throw new Error('Staging debe usar un proyecto Firebase separado de producción.');
  }
  if (target === 'production' && projectId !== productionProjectId) {
    throw new Error('El proyecto de producción debe coincidir con .firebaserc.');
  }
  if (typeof env.FIREBASE_WEB_CONFIG !== 'string' || !env.FIREBASE_WEB_CONFIG.trim()) {
    throw new Error('FIREBASE_WEB_CONFIG es obligatorio: utiliza la configuración pública de una app web.');
  }
  let config;
  try {
    config = JSON.parse(env.FIREBASE_WEB_CONFIG);
  } catch {
    // Do not echo a parser error: it may contain part of an accidentally supplied credential.
    throw new Error('FIREBASE_WEB_CONFIG debe contener JSON válido.');
  }
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error('FIREBASE_WEB_CONFIG debe ser un objeto de configuración web.');
  }
  if (Object.keys(config).some(key => !allowedFields.has(key))) {
    throw new Error('FIREBASE_WEB_CONFIG solo admite campos públicos de una app web; no admite credenciales de servicio.');
  }
  for (const field of requiredFields) {
    if (typeof config[field] !== 'string' || !config[field] || config[field] !== config[field].trim()) {
      throw new Error(`FIREBASE_WEB_CONFIG requiere el campo público ${field}.`);
    }
  }
  if (Object.values(config).some(value => typeof value !== 'string' || /[\r\n]|PRIVATE KEY|service_account/i.test(value))) {
    throw new Error('La configuración web solo admite valores públicos de texto, sin credenciales.');
  }
  if (config.projectId !== projectId) {
    throw new Error('projectId de FIREBASE_WEB_CONFIG debe coincidir con FIREBASE_PROJECT_ID.');
  }
  if (!/^AIza[A-Za-z0-9_-]{20,}$/.test(config.apiKey)) {
    throw new Error('apiKey debe ser la clave pública de una app web Firebase.');
  }
  if (config.authDomain !== `${projectId}.firebaseapp.com`) {
    throw new Error('authDomain debe ser el dominio Firebase predeterminado del proyecto seleccionado.');
  }
  if (![`${projectId}.appspot.com`, `${projectId}.firebasestorage.app`].includes(config.storageBucket)) {
    throw new Error('storageBucket debe ser el bucket Firebase predeterminado del proyecto seleccionado.');
  }
  if (!/^\d+$/.test(config.messagingSenderId)
    || !new RegExp(`^1:${config.messagingSenderId}:web:[a-fA-F0-9]+$`).test(config.appId)) {
    throw new Error('appId debe identificar una app web y coincidir con messagingSenderId.');
  }
  if (config.measurementId !== undefined && !/^G-[A-Z0-9]+$/.test(config.measurementId)) {
    throw new Error('measurementId debe identificar una propiedad de Analytics válida.');
  }
  return config;
}

function runAngular(root, env) {
  const result = spawnSync(process.execPath, [
    resolve(root, 'node_modules/@angular/cli/bin/ng.js'),
    'build', '--configuration', 'production,web',
  ], { cwd: root, stdio: 'inherit', env });
  if (result.error || result.status !== 0) {
    throw new Error('La compilación web falló; no publiques los archivos de una compilación anterior.');
  }
}

export function buildWeb({ target, env = process.env, root = repositoryRoot, compile = runAngular }) {
  const generatedFile = resolve(root, 'src/environments/firebaseConfig.web.generated.ts');
  const manifestFile = resolve(root, 'dist/web-deployment.json');
  // Remove only these two individual files. Never reuse a previous generated config or build manifest.
  rmSync(generatedFile, { force: true });
  rmSync(manifestFile, { force: true });
  try {
    let productionProjectId;
    try {
      productionProjectId = JSON.parse(readFileSync(resolve(root, '.firebaserc'), 'utf8')).projects?.production;
    } catch {
      throw new Error('No se pudo leer projects.production en .firebaserc.');
    }
    const config = validateWebConfig(target, env, productionProjectId);
    mkdirSync(dirname(generatedFile), { recursive: true });
    writeFileSync(generatedFile,
      `// Generated by scripts/build-web.mjs. Public Firebase client configuration.\nexport const firebaseConfig = ${JSON.stringify(config, null, 2)};\n`,
      'utf8');
    compile(root, env);
    if (!existsSync(resolve(root, 'dist/web/index.html'))) {
      throw new Error('La compilación no generó dist/web/index.html.');
    }
    writeFileSync(manifestFile, `${JSON.stringify({ environment: target, projectId: config.projectId }, null, 2)}\n`, 'utf8');
  } finally {
    rmSync(generatedFile, { force: true });
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error('Uso: node scripts/build-web.mjs staging|production');
    buildWeb({ target: process.argv[2] });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo compilar la aplicación web.');
    process.exitCode = 1;
  }
}
