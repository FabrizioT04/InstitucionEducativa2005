# Institución Educativa 2005

Aplicación de gestión escolar con Angular 20, Ionic 8, Capacitor 7 y Firebase Authentication, Firestore y Storage.

## Desarrollo local

Usar Node.js 22 (22.20.0 en `.nvmrc`) y npm 10. Desde la raíz del repositorio:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm start
```

La aplicación se sirve en `http://localhost:4200`. La configuración Firebase del cliente está en `src/environments/firebaseConfig.ts` y actualmente apunta al proyecto existente. Para pruebas manuales con escrituras, configurar un proyecto de desarrollo antes de iniciar sesión. No colocar credenciales del Admin SDK en el cliente.

```sh
npm run build
npm run lint
npm run test:foundation
```

`build` genera la aplicación web en `www/`. `test:foundation` ejecuta sin Firebase real las pruebas de regresión de los módulos refactorizados y requiere Chrome. En un entorno con una instalación diferente de Chrome, configurar `CHROME_BIN` con la ruta del ejecutable. `npm test` conserva la suite completa original; su modernización continúa por módulos. Las pruebas originales de `attendance-history` y `enroll-students` todavía contienen mocks incompatibles con Firestore modular y bloquean la compilación de esa suite. La integración continua compila producción, ejecuta el linter y valida las regresiones de esta etapa mediante `tsconfig.foundation.json`.

Para sincronizar una compilación con Android:

```sh
npx cap sync android
```

La generación del APK requiere además el SDK Android y el JDK correspondientes al proyecto Gradle.

## Organización

- `core/auth`: sesión verificada, perfil tipado, consultas de autorización y políticas reutilizables.
- `guards`: decisiones de navegación mediante `UrlTree`.
- `core/models/grade.model.ts`: validación, normalización y cálculo de notas.
- `core/services/grades.service.ts`: consultas y escrituras de calificaciones.
- `core/attendance`: modelo de asistencia diaria y acceso a datos.
- `shared/grade-summary`: presentación de notas compartida por las vistas del estudiante.
- Páginas: formularios y estados de carga, error y guardado. La lógica de negocio reutilizable pertenece a `core`.

## Contratos de datos

### Calificaciones

Se conservan las colecciones y campos existentes. Una calificación trimestral contiene `asignacionId`, `studentId`, `trimestre1`, `trimestre2`, `trimestre3`, `promedioFinal` y `fecha`.

- Escala adoptada: **0 a 20**, incluyendo decimales finitos.
- `null` representa un trimestre pendiente; `0` es una calificación válida.
- El promedio actual incluye solo los trimestres calificados, incluidos los ceros. Si todos están pendientes, también es `null`.
- Las lecturas recalculan el promedio a partir de los trimestres; las escrituras lo recalculan antes de guardar.
- Las evaluaciones antiguas con `nota` y `descripcion` siguen mostrándose. Los documentos trimestrales existentes conservan su ID; los nuevos usan un ID determinista por clase y estudiante.
- Si hay varios documentos trimestrales para un mismo estudiante y clase, la edición se bloquea para que se revisen los duplicados explícitamente.

No se puede distinguir automáticamente un cero antiguo que representaba una nota de uno que representaba un campo pendiente. Esta etapa conserva los ceros existentes y no modifica datos históricos en segundo plano.

### Asistencia

El modelo vigente representa **una asistencia por clase, estudiante y día**, con la zona horaria `America/Lima`. Los estados canónicos son `PRESENTE`, `AUSENTE` y `TARDANZA`; el valor histórico `FALTA` se interpreta como `AUSENTE`.

Al abrir la lista se recuperan los estados guardados para ese día. Al guardar se reutiliza el documento existente, o se genera un ID determinista si es nuevo. Los duplicados históricos no se borran: se selecciona de forma consistente el documento canónico o el registro antiguo más reciente. Las listas superiores a 450 escrituras se guardan por lotes; un fallo puede dejar lotes anteriores confirmados y el reintento conserva los mismos IDs.

El diseño diario debe ampliarse con un identificador de sesión si una clase necesita varias asistencias independientes el mismo día. Tampoco se separan aún las calificaciones por año escolar: esa ampliación requiere definir períodos y migrar los datos explícitamente.

## Permisos y Firebase

Las pantallas requieren correo verificado y un perfil con rol `administrador`, `profesor` o `estudiante`. La administración se limita al administrador; las notas y asistencias se limitan al administrador o al profesor asignado. El estudiante accede a las clases en las que está inscrito. Se reconocen ambos campos históricos de inscripción, `studentId` y `estudianteId`, en las consultas que se han adaptado.

Las guardas controlan la navegación; **la autorización de datos debe aplicarse también en las reglas de Firestore y Storage o en el backend**, como indica la [documentación de Angular](https://angular.dev/guide/routing/route-guards). Las reglas desplegadas no están versionadas en este repositorio y no se han modificado ni verificado en esta etapa. No debe permitirse que un usuario se asigne privilegios escribiendo su propio perfil.

La consulta diaria de asistencia requiere un índice compuesto, descrito en `firestore.indexes.json`: colección `asistencias`, ámbito colección, campos `asignacionId` ascendente y `fecha` ascendente. Antes de publicar esta versión, incorporar ese índice a la configuración del proyecto conservando los índices existentes y esperar a que esté disponible. Puede crearse en la consola siguiendo la [documentación de índices de Firestore](https://firebase.google.com/docs/firestore/query-data/indexing). No se ha desplegado ningún índice ni regla automáticamente.

## Siguientes módulos

1. Llevar el alta, desactivación y eliminación administrativa de usuarios a un backend que verifique permisos y gestione Firebase Authentication y Firestore conjuntamente. Los flujos originales de creación y eliminación siguen pendientes de esa refactorización.
2. Versionar las reglas e índices existentes y probar permisos con Firebase Emulator Suite antes de desplegar cambios de seguridad.
3. Unificar definitivamente los nombres de campos de matrícula mediante una migración revisada, incorporar períodos académicos y resolver duplicados históricos.
4. Completar paginación, servicios y pruebas de los módulos administrativos restantes.
