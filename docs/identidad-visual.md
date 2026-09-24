# Identidad visual de Data's World

Decidida por el usuario el 2026-09-24. Maqueta: [concepto visual en claude.ai](https://claude.ai/artifact/L5ZMrkhoKYL8kQ4oiWA25j) (privada; se comparte desde su menú *Share*).

## Nombre y concepto
**Data's World.** El nombre está inspirado en el androide Data: alguien que aprende a ser persona. Así se piensan los ciudadanos del mundo:
- **autónomos**: deciden solos y el motor solo valida lo que piden;
- **curiosos**: creen cosas del mundo que pueden no ser ciertas;
- **con una vida**: cada historia se puede explicar, causa por causa.

La inspiración es solo conceptual. **No se usan logotipos, insignias ni la estética de pantallas de Star Trek**, que pertenecen a sus dueños. Los datos, las leyes y el territorio siguen siendo de Colombia (spec 029, ADR-006).

## Marca
Una "D" de 9 × 9 píxeles con **una sola chispa ámbar** dentro: la curiosidad que se enciende en cada ciudadano. El mismo ámbar marca en el visor lo que se aprende y lo seleccionado.

## Color
| Nombre | Hex | Uso |
|---|---|---|
| Noche andina | `#10151F` | fondo del visor (el mundo sigue de noche) |
| Papel | `#F4EFE6` | fondo de informes y fichas |
| Ámbar | `#E3A72F` | la chispa: curiosidad, aprendizaje, selección |
| Verde cordillera | `#3F8F6B` | parques, bienestar |
| Azul Caribe | `#2F6FB0` | agua, trabajo formal, enlaces |
| Arcilla | `#C8643B` | techos, tensión y conflicto |

Techos del mapa por estrato: estrato 2 `#B4552F`, estrato 3 `#C87A45`, estrato 4 `#DDA36A`.

## Tipografía
- **Space Grotesk**: títulos.
- **IBM Plex Sans**: texto.
- **IBM Plex Mono**: datos (ids, eventos, fechas).

## Estilo
Pixel art a escala de tile, 64 × 40 tiles de 8 m, como el prototipo. Cada persona es un punto ámbar en el mapa, y las fichas combinan un retrato pixel con los datos. Se aplica en el visor (spec 024, M4) y en las salidas de la CLI donde tenga sentido (`world:map`).
