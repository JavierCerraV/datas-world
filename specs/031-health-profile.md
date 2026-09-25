---
id: 031
nombre: health-profile
estado: borrador
hito: M1 (ficha inicial) · M2 (efectos en necesidades, rutinas y economía) · peldaño 4 (evolución de las condiciones)
depende_de: [006, 007, 008, 009, 010, 014, 023, 029, 030]
version: 0.2
---

# 031 — Ficha de salud

## 1. Propósito
Cada persona tiene una **ficha de salud estable**: su afiliación al sistema de salud, sus condiciones crónicas, sus hábitos y su discapacidad, si la tiene. La ficha explica parte de lo que le pasa (se cansa antes, gasta en medicamentos, no puede hacer ciertas actividades) y parte de por qué terminó donde terminó.

Implementa lo que la visión pide en §24 (eventos probabilísticos: "enfermedad"), §25 (`P(enfermedad | edad, hábitos, exposición)`, no `random()`) y en la lista de lo que modifica la edad: "salud".

Se diferencia de la spec 010, que trata la salud **dinámica**: enfermedades agudas (`FELL_ILL`), energía, estrés. La ficha es el **terreno** sobre el que actúa la 010: cambia despacio y con eventos.

**No es una historia clínica.** Son personas, no pacientes (007 §1), y la capa clínica es posterior (CLAUDE.md §1). No se registran diagnósticos de salud mental en esta versión (§10).

## 2. Alcance
**Incluye:**
- afiliación al Sistema General de Seguridad Social en Salud (SGSSS): régimen contributivo, subsidiado o especial, o sin afiliación;
- condiciones crónicas del catálogo `health_conditions`, con código CIE-10 y fecha de diagnóstico;
- hábitos: tabaco, alcohol, actividad física y horas de sueño habituales;
- estado nutricional (categoría de índice de masa corporal);
- discapacidad, por dominios funcionales (como el censo del DANE);
- la generación de la ficha inicial y su trayectoria previa (diagnósticos del pasado, con causas);
- las reglas de efecto que usarán la 010 (necesidades), la 011 (rutinas), la 015 (gasto) y la 032 (esparcimiento).

**Fuera de alcance:**
- enfermedades agudas y su curso (010);
- atención en el hospital o el centro de salud como servicio (M2+, con 004 y 017);
- salud mental y diagnósticos psicológicos (capa clínica, posterior; §10);
- muerte en el presente simulado (007, peldaño 4).

## 3. Modelo de datos
Números por persona en columnas (ADR-005); la lista de condiciones, en la entidad.

| Columna | Tipo | Valores |
|---|---|---|
| `health.physical` | `f32` | ya existe (007): salud física base en [0,1]. Ahora se **deriva** de edad, condiciones y hábitos (R-006) |
| `health.insurance` | `u8` | 0 sin afiliación · 1 contributivo cotizante · 2 contributivo beneficiario · 3 subsidiado · 4 especial o de excepción |
| `health.bmiClass` | `u8` | 0 bajo peso · 1 normal · 2 sobrepeso · 3 obesidad |
| `health.tobacco` | `u8` | 0 nunca · 1 exfumador · 2 fuma |
| `health.alcohol` | `u8` | 0 no bebe · 1 ocasional · 2 frecuente · 3 consumo de riesgo |
| `health.activityDays` | `u8` | días por semana con ≥ 30 min de actividad física (0–7) |
| `health.sleepHours` | `u8` | horas de sueño habituales (4–10); la 010 parte de aquí |
| `health.disability` | `u8` | máscara de bits por dominio: 1 ver · 2 oír · 4 caminar · 8 usar manos · 16 entender o recordar · 32 autocuidado · 64 comunicarse |

```ts
interface HealthCondition {
  key: string;            // clave del catálogo health_conditions (p. ej. 'cronica.hipertension')
  since: WorldMinute;     // fecha del diagnóstico (< 0 si es previo al presente)
  controlled: boolean;    // en tratamiento y controlada
}
interface Citizen { /* …007 */ conditions?: HealthCondition[] } // en orden de `since`
```

**Catálogo `health_conditions`** (ADR-006), con código CIE-10 (la clasificación oficial en Colombia):

| Clave | Nombre | CIE-10 | Efectos (multiplicadores, estimados) |
|---|---|---|---|
| `cronica.hipertension` | Hipertensión arterial | I10 | riesgo cardiovascular; gasto en medicamentos |
| `cronica.diabetes_2` | Diabetes tipo 2 | E11 | energía −; gasto; dieta |
| `cronica.epoc` | Enfermedad pulmonar obstructiva crónica | J44 | energía −−; actividad física limitada |
| `cronica.asma` | Asma | J45 | crisis ocasionales (010) |
| `cronica.artrosis` | Artrosis | M19 | dolor; caminar − |
| `cronica.lumbalgia` | Dolor lumbar crónico | M54.5 | trabajos físicos − |
| `cronica.renal` | Enfermedad renal crónica | N18 | energía −−; gasto |
| `cronica.hipotiroidismo` | Hipotiroidismo | E03 | energía − |

Cada entrada lleva sus atributos: edad mínima, factores de riesgo (edad, sexo, `bmiClass`, tabaco, actividad) y efectos. Crecer es añadir entradas, no código.

Coste estimado por persona: 8 columnas × 1–4 B = 11 B, más ≈ 1,2 condiciones × 24 B ≈ 30 B. Para 200 personas, < 10 KB.

## 4. Reglas
- **R-001 (M1, afiliación)** — La afiliación sigue la ley colombiana (Ley 100 de 1993):
  - quien tiene empleo formal es **cotizante** del contributivo (006);
  - su cónyuge y sus hijos menores de 25 que estudian son **beneficiarios**;
  - un pensionado cotiza al contributivo;
  - el resto está en el **subsidiado** con probabilidad `INSURANCE_SUBSIDIZED_P`, y si no, **sin afiliación**. La probabilidad de estar en el subsidiado baja con el estrato;
  - el régimen especial o de excepción (docentes oficiales, fuerzas militares, policía, Ecopetrol, universidades públicas) aplica según la ocupación (CIUO) y el empleador (`org_sectors`).
- **R-002 (M1, hábitos y peso)** — Los hábitos se sortean con prevalencias del perfil por edad y sexo, moduladas por la personalidad (009):
  - la impulsividad sube el tabaco y el alcohol;
  - la responsabilidad sube la actividad física;
  - el valor "salud" sube la actividad y baja el tabaco.

  `bmiClass` depende de la edad, el sexo, el estrato y la actividad física.
- **R-003 (M1, condiciones)** — Cada condición del catálogo se asigna con probabilidad `P(c | edad, sexo, factores)` = prevalencia base del perfil × los multiplicadores de sus factores de riesgo. Nunca con `random()` sin modelo (visión §25). La fecha del diagnóstico se sortea entre la edad mínima y el presente, y genera `CONDITION_DIAGNOSED` en la trayectoria.
- **R-004 (M1, discapacidad)** — La prevalencia de discapacidad por edad sigue el perfil (DANE, CNPV 2018). Los dominios se sortean con sus pesos relativos. Una discapacidad de caminar o de autocuidado baja la probabilidad de empleo (006) y excluye actividades del catálogo de esparcimiento (032).
- **R-005 (M1, coherencia)** — Un menor de 15 no fuma ni bebe. Nadie tiene una condición antes de su edad mínima. Los hábitos de un menor dependen de su edad (actividad física escolar).
- **R-006 (M1)** — `health.physical` = 1 − Σ efectos de sus condiciones − efecto de la edad − efecto de los hábitos, limitado a [0,05, 1]. Sustituye al valor constante de 007.
- **R-007 (M2, efectos)** — La ficha modifica, con parámetros del perfil:
  - la caída de la energía y la probabilidad de `FELL_ILL` (010);
  - las horas de sueño de partida (010, 011);
  - el gasto mensual en salud: copagos y cuotas moderadoras según el régimen y el estrato, más medicamentos (015);
  - las actividades de esparcimiento posibles (032).
- **R-008 (peldaño 4, evolución)** — Los hábitos pueden cambiar (`HABIT_CHANGED`, por ejemplo dejar de fumar tras un diagnóstico) y pueden aparecer condiciones nuevas con la edad (`CONDITION_DIAGNOSED`), siempre con causas.
- **R-009 (historia)** — Los antepasados de la historia generada (030) no tienen ficha. Su causa de muerte sigue siendo la de la 030.

## 5. Eventos
| Tipo | Cuándo | Payload | Causas esperadas |
|---|---|---|---|
| `HEALTH_INSURANCE_SET` | afiliación inicial o cambio de régimen | citizenId, regime | empleo formal (`JOB_HIRED`), hogar, estrato |
| `CONDITION_DIAGNOSED` | diagnóstico de una condición crónica | citizenId, condition, cie10 | edad, hábitos, peso (estados), herencia familiar |
| `HABIT_CHANGED` (peldaño 4) | empieza o deja un hábito | citizenId, habit, from, to | diagnóstico, relación, estrés |
| `DISABILITY_ACQUIRED` (peldaño 4) | accidente o condición | citizenId, domains | accidente, condición |

## 6. Invariantes
- **INV-001** — Los valores de las columnas están en su rango; `health.physical` está en [0,05, 1] y sin NaN.
- **INV-002** — La afiliación es coherente: un empleado formal no está en el subsidiado ni sin afiliación. Un beneficiario tiene en su hogar un cotizante del que depende.
- **INV-003** — Toda condición existe en el catálogo, su `since` es posterior a la edad mínima de la persona y anterior al presente.
- **INV-004** — Un menor de 15 años tiene `tobacco = 0` y `alcohol = 0`.

## 7. Criterios de aceptación
- **CA-001 (M1)** — *Dado* 20 mundos con el perfil colombiano, *entonces* la afiliación agregada está dentro de ±0,05 del perfil: contributivo, subsidiado, especial y sin afiliación.
- **CA-002 (M1)** — *Dado* 20 mundos, *entonces* la prevalencia agregada en adultos de hipertensión, diabetes, exceso de peso, tabaquismo y discapacidad está dentro de ±0,04 del perfil.
- **CA-003 (M1)** — *Dado* un mundo, *entonces* se cumplen INV-001 a INV-004, y cada condición tiene su `CONDITION_DIAGNOSED` con causas.
- **CA-004 (M1)** — *Dado* 20 mundos, *entonces* `health.physical` baja con la edad (su media en 60+ es menor que en 18–39) y con el número de condiciones.
- **CA-005 (M1)** — *Dado* la misma semilla, *entonces* la ficha es idéntica (023).
- **CA-006 (M2)** — *Dado* dos personas iguales salvo EPOC en una, *cuando* pasan 7 días, *entonces* la energía media de la que tiene EPOC es menor.

## 8. Parámetros y calibración
Todos van en el perfil de país (029), con fuente y estado.

| Parámetro | Valor inicial | Fuente / justificación | Estado |
|---|---|---|---|
| `health.insurance.share` | subsidiado 0,503 · sin afiliación 0,017 (cobertura 98,3 %) · especial o de excepción ≈ 0,04 · contributivo, el resto (≈ 0,44) | Así Vamos en Salud, con datos de MinSalud, corte de marzo de 2024 (subsidiado y cobertura). El reparto entre contributivo y especial es estimado | oficial (subsidiado, cobertura) · estimado (especial) |
| `health.bmi.adult` | exceso de peso (sobrepeso + obesidad) 0,564 en adultos de 18 a 64; obesidad 0,187 (mujeres 0,224, hombres 0,144) | ENSIN 2015 (MinSalud, ICBF) | oficial |
| `health.activity.meetsGuideline` | 0,511 de los adultos de 18 a 64 | ENSIN 2015 | oficial |
| `health.tobacco.current` | ≈ 0,10 de la población de 12 a 65 años (último mes); 0,333 alguna vez (hombres 0,430, mujeres 0,243) | ENCSPA 2019, DANE (citado en fuentes secundarias para el último mes) | oficial |
| `health.alcohol.lastMonth` | 0,301 de la población de 12 a 65 años; 0,840 alguna vez | ENCSPA 2019, DANE | oficial |
| `health.disability.byAge` | 0,071 del total (3 134 036 personas), con fuerte aumento desde los 60; otras encuestas dan entre 0,045 y 0,06 | DANE, CNPV 2018 | oficial (total) · estimado (por edad) |
| `health.conditions.prevalence` | hipertensión 11,91 y diabetes 4,43 por cada 100 habitantes (diagnosticados); por edad y sexo, estimado | Cuenta de Alto Costo, 2024 | oficial (total) · estimado (por edad) |
| efectos de las condiciones | multiplicadores sobre energía, gasto y actividades | estimado, para calibrar en M2 | estimado |

## 9. Métricas y observabilidad
`world:report --health` muestra:
- la afiliación por régimen y estrato;
- la prevalencia de cada condición y cada hábito por edad y sexo, frente al perfil;
- la discapacidad por dominio;
- la distribución de `health.physical`.

Alerta si una prevalencia sale del intervalo o si hay beneficiarios sin cotizante.

## 10. Preguntas abiertas
- [x] ¿Se genera la ficha en M1 o al empezar M2? → En M1, bloque J (usuario, 2026-09-24).
- [x] ¿Salud mental? → No en esta spec: pertenece a la capa clínica (spec 034). El malestar del día a día lo cubren el estrés y el ánimo (010) (usuario, 2026-09-24).
- [x] ¿Nombres de EPS? → Sin marcas reales: solo el régimen (usuario, 2026-09-24).
- [x] ¿La herencia familiar sube el riesgo? → Sí, con un multiplicador estimado. Los antepasados (030) reciben solo hipertensión y diabetes (usuario, 2026-09-24).
- [x] Cifras de §8 → verificadas el 2026-09-24 con fuentes oficiales o secundarias que las citan. Quedan estimados el reparto contributivo y especial, las prevalencias por edad y los efectos.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-24 | 0.1 | Borrador inicial a petición del usuario: ficha de salud de cada persona (afiliación al SGSSS, condiciones crónicas con CIE-10, hábitos, peso y discapacidad), complementaria de la salud dinámica de la 010 |
| 2026-09-24 | 0.2 | Decisiones del usuario (§10) y cifras verificadas (§8): afiliación (subsidiado 50,3 %, cobertura 98,3 %, marzo de 2024), ENSIN 2015, ENCSPA 2019, CNPV 2018 y Cuenta de Alto Costo 2024 (hipertensión 11,91 %, diabetes 4,43 %) |
