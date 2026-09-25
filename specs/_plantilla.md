---
id: NNN
nombre: nombre-corto
estado: borrador        # borrador | en-revision | aprobada | implementada | obsoleta
hito: M?
depende_de: []
version: 0.1
---

# NNN — Título

## 1. Propósito
Qué problema resuelve y qué parte de la visión implementa (citar secciones de `docs/vision/`).

## 2. Alcance
**Incluye:** …
**Fuera de alcance:** … (y en qué spec se trata)

## 3. Modelo de datos
```ts
// Tipos TypeScript del dominio. Rangos, unidades y valores por defecto en comentarios.
```
Coste estimado de memoria por entidad: … bytes.

## 4. Reglas
- **R-001** [M] — Regla verificable, con parámetros nombrados (`PARAM_NAME = valor`) y su etiqueta de estatus epistémico (§4 bis).

## 4 bis. Estatus epistémico
Cada regla lleva una etiqueta (obligatoria en las specs de conducta, 035–042 y 009 v1.0; recomendada en las demás):
- **[E] empírico:** fenómeno replicado en la literatura experimental. Se cita la fuente; si no está en `docs/investigacion/`, con "(referencia a verificar)".
- **[T] teórico:** afirmación conceptual sostenida por la literatura (TMR, ACT, análisis funcional) sin modelo cuantitativo estándar.
- **[M] supuesto de modelado:** decisión del proyecto para poder computar algo, con parámetros explícitos.

Lo que dependa de un juicio experto que no tenemos se implementa como [M] parametrizado y se registra en `docs/investigacion/preguntas-abiertas.md` con su ID (`PA-xxx`), que se cita junto a la regla.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|

## 6. Invariantes
- **INV-001** — Condición que debe cumplirse siempre (se comprueba en pruebas y en modo debug).

## 7. Criterios de aceptación
- **CA-001** — *Dado* … *cuando* … *entonces* …

## 8. Parámetros y calibración
| Parámetro | Valor por defecto | Rango | Fuente / justificación |
|---|---|---|---|

## 9. Métricas y observabilidad
Qué se mide para saber que funciona (distribuciones esperadas, alertas de degeneración).

## 10. Preguntas abiertas
- [ ] …

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
