import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildWeb, validateWebConfig } from './build-web.mjs';
import { verifyWebDeployment } from './verify-web-deployment.mjs';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionProject = JSON.parse(readFileSync(resolve(repositoryRoot, '.firebaserc'), 'utf8')).projects.production;
const stagingProject = 'demo-ie2005-staging';
const temporaryRoots = [];

function config(projectId = stagingProject) {
  return {
    apiKey: 'AIzaSyDummyKeyForBuildOnly000000000000000',
    authDomain: `${projectId}.firebaseapp.com`,
    projectId,
    storageBucket: `${projectId}.firebasestorage.app`,
    messagingSenderId: '123456789012',
    appId: '1:123456789012:web:0000000000000000000000',
  };
}

function env(webConfig = config()) {
  return { FIREBASE_PROJECT_ID: webConfig.projectId, FIREBASE_WEB_CONFIG: JSON.stringify(webConfig) };
}

function fixture() {
  const root = mkdtempSync(resolve(tmpdir(), 'ie2005-web-build-'));
  temporaryRoots.push(root);
  mkdirSync(resolve(root, 'src/environments'), { recursive: true });
  mkdirSync(resolve(root, 'dist/web'), { recursive: true });
  writeFileSync(resolve(root, '.firebaserc'), JSON.stringify({ projects: { production: productionProject } }));
  return root;
}

after(() => {
  for (const root of temporaryRoots) {
    const withinTemp = relative(resolve(tmpdir()), resolve(root));
    assert.ok(withinTemp && !withinTemp.startsWith(`..${sep}`) && withinTemp !== '..');
    assert.ok(basename(root).startsWith('ie2005-web-build-'));
    rmSync(root, { recursive: true, force: true });
  }
});

test('accepts separate staging and the declared production project', () => {
  assert.deepEqual(validateWebConfig('staging', env(), productionProject), config());
  assert.deepEqual(validateWebConfig('production', env(config(productionProject)), productionProject), config(productionProject));
});

test('accepts both generations of the default storage bucket and optional Analytics ID', () => {
  const value = { ...config(), storageBucket: `${stagingProject}.appspot.com`, measurementId: 'G-123ABC' };
  assert.deepEqual(validateWebConfig('staging', env(value), productionProject), value);
});

test('rejects missing environment variables, unknown targets and invalid production metadata', () => {
  assert.throws(() => validateWebConfig('staging', {}, productionProject), /FIREBASE_PROJECT_ID/);
  assert.throws(() => validateWebConfig('staging', { FIREBASE_PROJECT_ID: stagingProject }, productionProject), /FIREBASE_WEB_CONFIG/);
  assert.throws(() => validateWebConfig('preview', env(), productionProject), /entorno/);
  assert.throws(() => validateWebConfig('staging', env(), undefined), /projects.production/);
});

test('rejects production data in staging, another production project and a mismatched JSON project', () => {
  assert.throws(() => validateWebConfig('staging', env(config(productionProject)), productionProject), /separado/);
  assert.throws(() => validateWebConfig('production', env(), productionProject), /producción/);
  const mismatched = { ...env(), FIREBASE_PROJECT_ID: 'another-staging-project' };
  assert.throws(() => validateWebConfig('staging', mismatched, productionProject), /coincidir/);
});

test('rejects malformed JSON without echoing potentially sensitive values', () => {
  for (const raw of ['{"private_key":"SENSITIVE-MARKER', 'null', '[]', '"SENSITIVE-MARKER"']) {
    assert.throws(() => validateWebConfig('staging', { ...env(), FIREBASE_WEB_CONFIG: raw }, productionProject), error => {
      assert.equal(error.message.includes('SENSITIVE-MARKER'), false);
      return true;
    });
  }
});

test('rejects service account credentials, unknown fields and nested credentials', () => {
  for (const extra of [
    { type: 'service_account', private_key: 'SENSITIVE-MARKER' },
    { client_email: 'SENSITIVE-MARKER' },
    { credentials: { private_key: 'SENSITIVE-MARKER' } },
    { accessToken: 'SENSITIVE-MARKER' },
  ]) {
    assert.throws(() => validateWebConfig('staging', env({ ...config(), ...extra }), productionProject), error => {
      assert.match(error.message, /públicos/);
      assert.equal(error.message.includes('SENSITIVE-MARKER'), false);
      return true;
    });
  }
  assert.throws(() => validateWebConfig('staging', env({ ...config(), apiKey: '-----BEGIN PRIVATE KEY-----' }), productionProject), /credenciales/);
});

test('requires every client field and rejects malformed or crossed project identifiers', () => {
  for (const field of Object.keys(config())) {
    const incomplete = config();
    delete incomplete[field];
    assert.throws(() => validateWebConfig('staging', { ...env(), FIREBASE_WEB_CONFIG: JSON.stringify(incomplete) }, productionProject));
  }
  for (const invalid of [
    { apiKey: 'wrong-key' },
    { authDomain: `${productionProject}.firebaseapp.com` },
    { storageBucket: `${productionProject}.appspot.com` },
    { appId: '1:999:web:00000' },
    { appId: '1:123456789012:android:00000' },
    { messagingSenderId: '123[456' },
    { measurementId: 'not-an-analytics-id' },
    { apiKey: ['invalid'] },
  ]) {
    assert.throws(() => validateWebConfig('staging', env({ ...config(), ...invalid }), productionProject));
  }
});

test('a rejected build removes prior generated configuration and manifest without running Angular', () => {
  const root = fixture();
  const generated = resolve(root, 'src/environments/firebaseConfig.web.generated.ts');
  const manifest = resolve(root, 'dist/web-deployment.json');
  const previousIndex = resolve(root, 'dist/web/index.html');
  writeFileSync(generated, 'previous config');
  writeFileSync(manifest, '{}');
  writeFileSync(previousIndex, 'previous build');
  let compiled = false;
  assert.throws(() => buildWeb({ root, target: 'staging', env: {}, compile: () => { compiled = true; } }));
  assert.equal(compiled, false);
  assert.equal(existsSync(generated), false);
  assert.equal(existsSync(manifest), false);
  assert.equal(readFileSync(previousIndex, 'utf8'), 'previous build');
});

test('compilation receives only the validated project and success creates a deployment manifest', () => {
  const root = fixture();
  const generated = resolve(root, 'src/environments/firebaseConfig.web.generated.ts');
  buildWeb({ root, target: 'staging', env: env(), compile: buildRoot => {
    assert.equal(buildRoot, root);
    const source = readFileSync(generated, 'utf8');
    assert.ok(source.includes(stagingProject));
    assert.equal(source.includes(productionProject), false);
    writeFileSync(resolve(root, 'dist/web/index.html'), '<base href="/">');
  } });
  assert.equal(existsSync(generated), false);
  assert.deepEqual(JSON.parse(readFileSync(resolve(root, 'dist/web-deployment.json'), 'utf8')),
    { environment: 'staging', projectId: stagingProject });
});

test('a failed compiler or missing web output cannot leave a successful deployment manifest', () => {
  for (const compile of [() => { throw new Error('compiler failed'); }, () => {}]) {
    const root = fixture();
    assert.throws(() => buildWeb({ root, target: 'staging', env: env(), compile }));
    assert.equal(existsSync(resolve(root, 'src/environments/firebaseConfig.web.generated.ts')), false);
    assert.equal(existsSync(resolve(root, 'dist/web-deployment.json')), false);
  }
});

test('the predeploy hook accepts a matching build and rejects publication to another project', () => {
  const root = fixture();
  buildWeb({ root, target: 'staging', env: env(), compile: () => {
    writeFileSync(resolve(root, 'dist/web/index.html'), '<base href="/">');
  } });
  assert.doesNotThrow(() => verifyWebDeployment(stagingProject, root));
  assert.throws(() => verifyWebDeployment(productionProject, root), /no coincide/);
  assert.throws(() => verifyWebDeployment(undefined, root), /GCLOUD_PROJECT/);
});

test('a failed subsequent build prevents publication of the old files', () => {
  const root = fixture();
  buildWeb({ root, target: 'staging', env: env(), compile: () => {
    writeFileSync(resolve(root, 'dist/web/index.html'), '<base href="/">');
  } });
  assert.throws(() => buildWeb({ root, target: 'staging', env: {} }));
  assert.throws(() => verifyWebDeployment(stagingProject, root), /compilación web válida/);
});

test('the predeploy hook rejects an incorrect environment and mobile base URL', () => {
  const root = fixture();
  const manifest = resolve(root, 'dist/web-deployment.json');
  writeFileSync(manifest, JSON.stringify({ environment: 'staging', projectId: productionProject }));
  writeFileSync(resolve(root, 'dist/web/index.html'), '<base href="/">');
  assert.throws(() => verifyWebDeployment(productionProject, root), /entorno/);
  writeFileSync(manifest, JSON.stringify({ environment: 'production', projectId: productionProject }));
  assert.doesNotThrow(() => verifyWebDeployment(productionProject, root));
  writeFileSync(resolve(root, 'dist/web/index.html'), '<base href="./">');
  assert.throws(() => verifyWebDeployment(productionProject, root), /rutas web/);
});
