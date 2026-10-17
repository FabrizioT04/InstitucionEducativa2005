# Despliegue web en Firebase Hosting

Esta aplicación se compila como una SPA estática. Hosting publica `dist/web/`; Firebase Authentication, Firestore y Storage siguen siendo servicios independientes. Android usa `www/` mediante Capacitor y tiene su propio proceso de distribución.

## Entornos y compilación

| Destino | Comando | Salida | Configuración Firebase |
| --- | --- | --- | --- |
| Capacitor | `npm run build` | `www/` | `src/environments/firebaseConfig.ts`, proyecto existente |
| Web de pruebas | `npm run build:web:staging` | `dist/web/` | Variables explícitas del proyecto de pruebas |
| Web de producción | `npm run build:web:production` | `dist/web/` | Variables explícitas del proyecto de producción |

Los dos builds web usan optimización de producción y base `/`, de modo que los recursos se resuelven desde la raíz incluso al abrir una ruta como `/tabs/tab2`. `firebase.json` redirige las rutas a `/index.html`. El HTML se revalida; los JS y CSS con hash pueden conservarse en caché. Los patrones RE2 de Hosting también funcionan en el emulador de Windows, donde los patrones glob de esta versión de la CLI normalizan las barras de las rutas de forma diferente.

El proyecto existente `institucioneducativa2005` está identificado como producción en `.firebaserc`, sin proyecto predeterminado. Para cambiarlo, revisar ese archivo junto con la configuración cliente y las variables de GitHub. Los comandos de publicación deben indicar siempre `--project`.

Cada build web exige:

- `FIREBASE_PROJECT_ID`: ID del proyecto al que se publicará.
- `FIREBASE_WEB_CONFIG`: objeto JSON de configuración **de la aplicación web**, disponible en Firebase Console → configuración del proyecto → tus aplicaciones → configuración del SDK. Debe incluir `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId` y `appId`; `measurementId` es opcional. Usar JSON con claves entre comillas, sin `const firebaseConfig =`.

Se comprueba que los IDs coincidan, que pruebas y producción sean proyectos distintos y que producción coincida con `.firebaserc`. Esta configuración admite el `authDomain` estándar del proyecto y sus buckets predeterminados `.appspot.com` o `.firebasestorage.app`. Un dominio de autenticación o bucket personalizado requerirá ampliar esa validación de forma explícita.

La configuración web es pública y acaba incluida en JavaScript. No introducir una cuenta de servicio, una clave privada ni credenciales Admin SDK: el build las rechaza. La configuración generada es temporal, se ignora en Git y se elimina al finalizar. Una compilación correcta deja `dist/web-deployment.json` fuera de la carpeta publicada para identificar el entorno y proyecto. El hook `predeploy` compara ese manifiesto con el destino que proporciona Firebase CLI y bloquea la publicación si no coinciden o si falta un build válido.

## Preparación de Firebase

1. Crear un proyecto de pruebas independiente y registrar su aplicación web. Habilitar los servicios que utiliza la aplicación y crear cuentas ficticias para administrador, profesor y estudiante. No copiar datos personales para estas pruebas.
2. Recuperar y revisar las reglas e índices actuales de Firestore y Storage antes de modificarlos. Las guardas de Angular no sustituyen la autorización de datos. Comprobar que un estudiante no pueda modificar notas ni su propio rol, y que un profesor solo pueda gestionar sus clases.
3. Incorporar el índice de `firestore.indexes.json` conservando los existentes, y esperar a que esté disponible. Este repositorio todavía no contiene una copia completa de las reglas e índices desplegados.
4. Activar Hosting en cada proyecto. Revisar los dominios autorizados y los enlaces de verificación/restablecimiento de Firebase Authentication según los dominios utilizados.
5. Antes de habilitar producción, corregir o deshabilitar las operaciones administrativas de alta y baja de cuentas que aún necesitan un backend autorizado. Revisar los pendientes descritos en el README.

`firebase.json` configura únicamente Hosting y su emulador. Los workflows no despliegan reglas, índices, Functions ni datos. Al publicar una preview, Firebase CLI puede agregar su dominio a los dominios autorizados de Authentication en staging; revisar cualquier aviso de permisos. Una URL de preview utiliza los servicios indicados en el JavaScript compilado: no crea una base de datos aislada. Por eso el build de staging exige otro proyecto. Ver [entornos Firebase](https://firebase.google.com/docs/projects/dev-workflows/general-best-practices) y [vistas previas](https://firebase.google.com/docs/hosting/test-preview-deploy).

## Configuración de GitHub

Crear los entornos **staging** y **production** en Settings → Environments del repositorio. En cada uno configurar:

| Tipo | Nombre | Valor |
| --- | --- | --- |
| Variable | `FIREBASE_PROJECT_ID` | ID del proyecto de ese entorno |
| Variable | `FIREBASE_WEB_CONFIG` | JSON cliente de la aplicación web de ese proyecto |
| Secret | `FIREBASE_SERVICE_ACCOUNT` | JSON privado de la cuenta de servicio que publica Hosting en ese proyecto |

Usar una cuenta de servicio distinta por proyecto y permisos limitados a la publicación. La [guía de la acción Firebase](https://github.com/FirebaseExtended/action-hosting-deploy/blob/main/docs/service-account.md) describe los permisos necesarios. Guardar el JSON privado solo como secret del entorno, nunca en código, artifacts o variables públicas. El workflow comprueba que su `project_id` corresponda al destino y entrega la credencial únicamente al paso de verificación y a la acción de despliegue.

Restringir el entorno `production` a la rama `main` y, cuando corresponda, configurar revisores requeridos. La configuración de estos entornos y credenciales se hace en las cuentas de GitHub/Firebase; no se crea al fusionar el PR.

### Vistas previas por PR

Después de preparar staging, añadir una **variable del repositorio** `ENABLE_FIREBASE_PREVIEWS` con valor `true`. Mientras falte o sea distinta de `true`, la validación continúa funcionando y el despliegue de preview se omite.

Los PR del mismo repositorio podrán publicar un canal de pruebas después de pasar compilación, lint y pruebas. La CI también inicia el emulador de Hosting con un proyecto sintético y verifica respuestas HTML para cuatro rutas, carga de bundles y cabeceras de caché. Los PR de forks nunca reciben el secreto de staging. El enlace aparece en la ejecución de Actions; no se publican comentarios automáticos. Los canales caducan a los siete días desde su última actualización.

Un colaborador que pueda modificar las ramas usadas para previews puede ejecutar código con acceso a las credenciales de staging. Limitar sus permisos a ese proyecto y configurar revisores del entorno si el equipo lo requiere. Este flujo no usa `pull_request_target`.

### Producción manual

1. Integrar los cambios revisados en `main`. El workflow manual debe existir en la rama predeterminada para aparecer en Actions.
2. Completar los requisitos de Firebase anteriores y configurar el entorno `production`.
3. En Actions, abrir el workflow de producción y pulsar **Run workflow**, seleccionando `main`.
4. Se repetirán las verificaciones, se compilará con el JSON de producción y se publicará el canal `live` solo si todo termina correctamente. La ejecución rechaza otras ramas.
5. Comprobar la URL publicada con cuentas de cada rol. Una fusión por sí sola no publica producción.

Los despliegues de producción se serializan y una nueva solicitud no cancela un despliegue en curso. La acción Firebase y su CLI tienen versiones fijadas en los workflows. Ver [ejecución manual de GitHub Actions](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow).

## Pruebas desde PowerShell

Guardar el JSON cliente del proyecto de pruebas en `firebase.staging.local.json` en la raíz del repositorio (ignorado por Git). Con Node 22 y las dependencias instaladas:

```powershell
$env:FIREBASE_WEB_CONFIG = Get-Content -Raw firebase.staging.local.json
$env:FIREBASE_PROJECT_ID = ($env:FIREBASE_WEB_CONFIG | ConvertFrom-Json).projectId
npm run test:deployment
npm run build:web:staging
```

Solo tras una compilación correcta, iniciar Hosting local con la versión de CLI utilizada por los workflows:

```powershell
npx --yes firebase-tools@15.34.0 emulators:start --only hosting --project $env:FIREBASE_PROJECT_ID
```

El emulador de Hosting sirve en `http://localhost:5000`. **Solo emula Hosting**: cualquier inicio de sesión, lectura o escritura de la aplicación usa el Firebase de pruebas configurado. Para simular también Auth/Firestore/Storage hace falta conectar explícitamente sus emuladores; esta etapa no lo configura.

Comprobar apertura directa y recarga de `/login` y `/tabs/tab2`, inicio/cierre de sesión, recuperación de contraseña, permisos por rol, notas con cero y pendientes, y guardado repetido de asistencia del mismo día. Un usuario sin sesión debe ser redirigido sin errores de carga de JS.

Para una preview manual, iniciar sesión en Firebase CLI con la cuenta autorizada y, después de un build exitoso de staging, ejecutar:

```powershell
npx --yes firebase-tools@15.34.0 login
npx --yes firebase-tools@15.34.0 hosting:channel:deploy revision --expires 7d --project $env:FIREBASE_PROJECT_ID
```

El despliegue de producción recomendado es el workflow de GitHub, que obliga a ejecutar las comprobaciones. Si se usa la CLI manualmente, el hook exige que `dist/web-deployment.json` corresponda al proyecto de destino. Un build fallido puede dejar archivos anteriores en `dist/web/`, pero elimina el manifiesto y el hook impide publicarlos.

## Reversión

Si una versión web presenta problemas, volver a una versión anterior de Hosting desde su historial de versiones y verificar las rutas y el acceso. Esta reversión cambia los archivos web; no revierte escrituras realizadas en Firestore ni reglas o índices. Ver [versiones de Hosting](https://firebase.google.com/docs/hosting/manage-hosting-resources).

Para una nueva publicación desde GitHub, revertir el cambio de código en `main` mediante un PR y volver a ejecutar el workflow manual. Conservar las comprobaciones de permisos y la compatibilidad con los datos existentes antes de cada publicación.
