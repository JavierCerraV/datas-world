# Mundos de ejemplo

Mundos guardados de cada peldaño, versionados para probar que el motor siguiente los carga y los migra (spec 027 R-011, CA-007).

| Archivo | Peldaño | Motor | Cómo se creó | Hash tras crearlo |
|---|---|---|---|---|
| `m1-482917.db` | M1 (mundo estático con historia desde 1900) | 0.2.0, esquema 1 | `pnpm cli world:new --seed 482917 --db docs/validaciones/mundos/m1-482917.db` (perfil `CO-2026.09`) | `35a9d910aeb76f42` |
| `m2-482917.db` | M2 (vida diaria: necesidades, rutina, decisiones, movilidad, economía y trabajo) | 0.2.0, esquema 1 | `pnpm cli world:new --seed 482917 --db docs/validaciones/mundos/m2-482917.db` (hash `18d6bd6ed3951fd2`) y `pnpm cli world:advance --days 7 --db …` | `244dfb62cba61469` (1 de enero + 7 días) |

Contenido de `m1-482917.db`:
- 199 personas en 72 hogares;
- 1 106 antepasados;
- 111 lugares, 8 organizaciones y 177 objetos;
- 3 363 eventos (≈ 1,8 MB).

No se regeneran: un mundo de ejemplo es una foto del peldaño en que se creó. Si cambia la generación, el hash de un mundo nuevo será otro, pero este debe seguir cargándose.

La prueba `apps/cli/src/m1.test.ts` copia el archivo, lo carga con el motor actual (lo que verifica el hash guardado) y lo avanza un día.

**Motor funcional (MF1, 2026-09-25).** Desde la 009 v1.0 (temperamento) cambian los catálogos de personalidad, así que un mundo nuevo con la misma semilla tiene otro hash (009 INV-002). `m1-482917.db` se sigue cargando sin migrar: conserva sus columnas de la v0.3 (`pers.*` extra, `val.*`, `pers.coping`), que el motor ya no lee, y su hash guardado no cambia. Como no tiene `tmp.*`, el adaptador de temperamento usa 0,5 para esas personas.

**M2 (bloque H5, 2026-09-25).** `m2-482917.db` guarda una semana de vida diaria (≈ 4,8 MB, 8 instantáneas diarias; un mes ocuparía ≈ 11 MB). La prueba `apps/cli/src/m2.test.ts` lo copia, lo carga (hash verificado) y lo avanza un día con la vida diaria; y comprueba que el de M1, sin sus capacidades, sigue siendo estático (solo avanza el reloj).
