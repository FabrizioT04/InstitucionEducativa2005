import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function verifyWebDeployment(projectId, root = repositoryRoot) {
  if (!projectId) throw new Error('Firebase debe indicar el proyecto de destino mediante GCLOUD_PROJECT.');
  let manifest;
  let productionProjectId;
  let index;
  try {
    manifest = JSON.parse(readFileSync(resolve(root, 'dist/web-deployment.json'), 'utf8'));
    productionProjectId = JSON.parse(readFileSync(resolve(root, '.firebaserc'), 'utf8')).projects?.production;
    index = readFileSync(resolve(root, 'dist/web/index.html'), 'utf8');
  } catch {
    throw new Error('Falta una compilación web válida. Ejecuta build:web:staging o build:web:production antes de publicar.');
  }
  if (!productionProjectId || manifest?.projectId !== projectId) {
    throw new Error('El proyecto de Hosting no coincide con el proyecto de la compilación web.');
  }
  const expectedEnvironment = projectId === productionProjectId ? 'production' : 'staging';
  if (manifest.environment !== expectedEnvironment || !/<base\s+href=["']\/["']\s*\/?\s*>/i.test(index)) {
    throw new Error('La compilación no corresponde al entorno o a las rutas web esperadas.');
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    verifyWebDeployment(process.env.GCLOUD_PROJECT);
    console.log('El destino de Hosting coincide con la compilación web.');
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'No se pudo verificar el destino de Hosting.');
    process.exitCode = 1;
  }
}
