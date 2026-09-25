---
id: 041
nombre: development
estado: borrador
hito: MF (bloque MF7)
depende_de: [030, 035, 036, 037, 038, 039]
version: 0.1
---

# 041 — Desarrollo: historia de aprendizaje sintética (0 años → presente)

## 1. Propósito
Que las personas empiecen el mundo con funciones, relaciones, reglas, valores y repertorios que **salen de su historia**, no de un muestreo (ADR-008).
- Recorre la vida de cada persona como una secuencia de episodios de aprendizaje, a partir de la historia generada (030) y de su situación: hogar, estrato, estudios, empleo, eventos de infancia.
- Aplica los mismos mecanismos de las capas 2–5.

## 2. Alcance
**Incluye:**
- catálogo de episodios por etapa (crianza, colegio, pares, adolescencia, trabajo, pareja);
- comunidad verbal (familia, colegio, pares);
- densidad de episodios;
- reforzadores primarios iniciales;
- la construcción de los primeros reforzadores generalizados, reglas y redes de valor;
- el paso de lo relevante al `backstory`.

**Fuera de alcance:** la vida desde el 1 de enero de 2026 (mundo vivo).

## 3. Modelo de datos (preliminar)
```ts
interface EpisodeKind {              // catálogo `development_episodes` (ADR-006)
  key: string;                       // 'crianza.consuelo', 'colegio.elogio_tarea', 'pares.burla', 'familia.regla_obediencia'…
  stage: 'infancia' | 'escolar' | 'adolescencia' | 'adulto';
  when: Condition;                   // según hogar, estrato, estudios, eventos de 030 (p. ej. CHILDHOOD_EVENT)
  contingency?: { antecedent: StimulusId; response: ResponseClass; consequence: StimulusId; magnitude: number };
  verbal?: { speakerRole: 'madre' | 'padre' | 'docente' | 'par'; relation?: Relation; rule?: Partial<Rule> };
  ratePerYear: number;
}
```

## 4. Reglas
- **R-001** [M] — **Densidad:** ≈ 50 episodios por año de 0 a 18 y ≈ 12 por año después, hasta 2026, en orden temporal. Flujo `gen:development/<citizenId>`.
- **R-002** [T] — **Reforzadores primarios iniciales:** comida, contacto físico, calor (apetitivos); dolor, ruido fuerte, frío (aversivos), de la ontología (036 R-007; McHugh).
- **R-003** [T] — **Comunidad verbal:** la familia y el colegio enseñan relaciones (coordinación, oposición, comparación, jerarquía y deícticas), reglas de pliance y, con la edad, reglas de tracking. La calidad y el contenido dependen de episodios condicionados por el hogar y los eventos de 030.
- **R-004** [T] — **Reforzadores generalizados:** la aprobación y la crítica de los cuidadores se emparejan con varios primarios, y el dinero se empareja con compras; se vuelven generalizados (036 R-008).
- **R-005** [T] — **Valores:** redes jerárquicas que se construyen solo si hay episodios que ponen un dominio vital en jerarquía con reforzadores (038 R-006, R-009). Una persona puede llegar a 2026 sin ninguna red de valor fuerte.
- **R-006** [M] — **Eventos de 030 como contingencias mayores:** los `CHILDHOOD_EVENT`, muertes de familiares, migraciones, estudios y empleos se traducen en episodios de alta magnitud en su momento.
- **R-007** [M] — **Backstory:** pasan al registro de eventos (con causas) los episodios que crean una función, regla o red por encima de 0,3. El resto se resume en contadores (030 CA-007).
- **R-008** [M] — **Salidas para 031 y 032:** los hábitos de salud y la ficha de esparcimiento iniciales salen de las fuerzas de respuesta resultantes, no de rasgos. Esto retira el adaptador de temperamento en los generadores.

## 4 bis. Estatus epistémico
- [T]: el papel de la comunidad verbal y de los reforzadores primarios, secundarios y generalizados (McHugh).
- [M]: el catálogo de episodios, sus tasas, la densidad y la traducción de 030 a episodios. Pendiente de revisión experta (PA-120, PA-121).

## 5. Eventos
Los episodios relevantes quedan como `DEVELOPMENT_EPISODE` (en el pasado, `at < 0`), con causas en los eventos de 030 o en episodios anteriores.

## 6. Invariantes
- **INV-001** — Todo estado funcional inicial (función, relación, regla) de una persona tiene origen en un episodio o en un contador de episodios.
- **INV-002** — Misma semilla, misma historia de desarrollo; añadir personas no cambia a las demás.

## 7. Criterios de aceptación (iniciales)
- **CA-001** — `world:new` de 200 personas con desarrollo en < 60 s y < 2 MB adicionales en la base.
- **CA-002** — Para 10 personas al azar se reconstruye el origen de sus 5 funciones más fuertes hasta episodios concretos.
- **CA-003** — **Diversidad:**
  - la distribución del número de redes de valor, de reglas por tipo y de fuerzas de evitación iniciales no es degenerada (sd > umbral);
  - difiere por tipo de hogar y estrato en el sentido que fije el catálogo.
- **CA-004** — Divergencia desde la generación: dos personas con temperamento idéntico en hogares con episodios distintos llegan a 2026 con repertorios distintos (parte de 042 V-12).

## 8. Parámetros y calibración
| Parámetro | Valor | Estado |
|---|---|---|
| Episodios por año | 50 (0–18) / 12 (adulto) | [M], PA-121 |

## 10. Preguntas abiertas
PA-015, PA-031, PA-120, PA-121.

## 11. Historial de cambios
| Fecha | Versión | Cambio |
|---|---|---|
| 2026-09-25 | 0.1 | Borrador (Fase A, ADR-008) |
