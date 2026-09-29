# M3 · Causalidad hasta el origen (spec 019, bloque C) — validación

Fecha: 2026-09-29. Mundo de la semilla del proyecto (482917), 100 personas. Prueba: `packages/generators/src/relationships-world.test.ts` (1 año); medición previa y posterior con 60 días.

## Antes y después

| Métrica | Antes (M3 R y M) | Después (019) |
|---|---|---|
| Causas inexistentes o del futuro | 0 | 0 (y `makeEvent` las rechaza, R-002) |
| Eventos no espontáneos sin causa | 0 | 0 |
| Eventos que citan un estado y llegan a un hecho en profundidad 3 | 11 % | 73 % (CA-004: ≥ 60 %) |

Por tipo (60 días):

| Tipo | Eventos | Llegan a un hecho |
|---|---|---|
| Ocio elegido (`LEISURE_DONE`) | 7 435 | 86 %, por sus fuentes hasta los hechos que formaron sus funciones (R-006) |
| Roces y discusiones | 401 · 44 | 84 % · 100 % (la historia del par, 012) |
| Amistades | 29 | 83 % |
| Deudas e impagos | 7 · 5 | 86 % · 100 % (despido, deuda o impago anterior, R-005) |
| Enfermedades | 37 | 16 % (solo quien tuvo un hecho estresante reciente) |
| Se quedó dormido | 253 | 0 %: la deuda de sueño sale de su horario |
| Salario, arriendo, trayectos, inicio del día, olvidos, primeros encuentros | — | 0 %: su causa es el calendario, la rutina o el tiempo |

## Lo que reveló

1. **El sueño sale del horario.** En la población actual nadie pierde horas de sueño por actividades o rumiación dentro de su horario de dormir. La deuda de sueño viene de horarios que dejan dormir menos de lo necesario, y la cadena termina ahí con esa explicación (`horario_de_sueno`). Cuando la decisión pueda quitar horas de sueño, el origen `sueno` ya lo recoge.
2. **La poda de lectura esconde orígenes.** En el ocio, el aporte principal suele ser la saciedad (un estado), y la costumbre con su origen queda por debajo del 10 %. El árbol que se muestra poda esas ramas para leerlo; la medición de CA-004 las cuenta.
3. **La enfermedad se explica poco por hechos**, porque en 60 días pocas personas tienen un hecho estresante dentro de su ventana. Es coherente: la mayoría enferma por azar y por su salud física.

## Pendiente

- La saciedad podría citar la vez anterior que hizo la actividad.
- Ventanas de los orígenes (desempleo 365 días, dinero 90, enfermedad 30, malestar y conflicto 14, sueño 3) [M], para calibrar.
