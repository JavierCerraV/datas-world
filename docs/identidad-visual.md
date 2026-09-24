# Identidad visual de Data's World

Decidida por el usuario el 2026-09-24. Maqueta: [concepto visual en claude.ai](https://claude.ai/artifact/L5ZMrkhoKYL8kQ4oiWA25j), privada; se comparte desde su menú *Share*.

**Concepto elegido: B, "Pueblo soleado"**, en las pantallas *B · Portada*, *B · Vecinos* y *B · Ficha de ciudadano* de la maqueta. El concepto A ("noche andina") queda como alternativa y referencia histórica.

## Nombre y concepto
**Data's World.** El nombre está inspirado en el androide Data: alguien que aprende a ser persona. Así se piensan los ciudadanos:
- **autónomos:** deciden solos y el motor solo valida lo que piden;
- **curiosos:** creen cosas del mundo que pueden no ser ciertas;
- **con una vida:** cada historia se puede explicar, causa por causa.

Data's World simula **cualquier municipio** colombiano con su propia lógica. El nombre del municipio es un parámetro del mundo (`world:new --name`), no una marca.

La inspiración es solo conceptual. **No se usan logotipos, insignias ni la estética de pantallas de Star Trek**, que pertenecen a sus dueños. Los datos, las leyes y el territorio siguen siendo de Colombia (spec 029, ADR-006).

## Concepto B · Pueblo soleado (el que se aplica)

### Color
| Nombre | Hex | Uso |
|---|---|---|
| Crema | `#F3E6C8` | fondo de pantallas e informes |
| Papel de ficha | `#FFF7E6` | tarjetas |
| Tinta | `#2A2230` | texto, contornos de 3–6 px, sombra dura (`6px 6px 0`) |
| Texto secundario | `#5A4E44` | etiquetas |
| Arcilla | `#A13F2B` | acento, enlaces, rótulos |
| Pasto | `#7CBA4B` · `#6CA93F` · `#96CD62` | suelo del mapa |
| Tejados | rojo `#E4785A/#C9543A/#A13F2B` · verde azulado `#5E9FAE/#3E7C8C/#2C5D6B` · café `#A06E4B/#7C5037/#5C3A27` · pizarra `#716B7A/#524C5C/#3B3744` | casas y edificios |
| Asfalto | `#433D4A` (borde `#35303C`), líneas `#E9E0CD` | calles |
| Andén | `#CBC1B3` · `#B1A698` | aceras |
| Ladrillo | `#D9A766` · `#C08B4F` · `#9F6D3A` | avenida peatonal |
| Plaza y agua | `#E6C88F` · `#4FA3C7` · `#A6DCEC` | plaza con fuente |
| Barras de rasgo | `#4F8A32` sobre `#EDE0C4` | segmentos de 10 |

### Tipografía
- **Pixelify Sans:** títulos, rótulos y datos.
- **Nunito:** texto corrido.

### Vecinos (sprites)
Cada persona es un sprite propio de **16 × 24 píxeles**, con cabeza grande y contorno oscuro:
- **5 tonos de piel;**
- **8 peinados:** corto, bob, largo, moño, colitas, en punta, gorra y calvo;
- accesorios: gafas y barba;
- **canas según la edad;**
- **ropa según el oficio.**

En el mapa se usa una versión mini de 8 × 11. **Consecuencia para los datos:** cada ciudadano necesita una *apariencia* determinista (piel, peinado, color de pelo, accesorios), generada con la población (bloque F de M1) a partir de la semilla, la edad y la ocupación. El visor la dibuja en M4 (spec 024).

### Mapa
Vista cenital con:
- pasto con textura y flores;
- calles de asfalto con línea discontinua y andenes;
- una avenida peatonal de ladrillo con cebras;
- plaza con fuente y bancas;
- casas con tejados de colores, chimenea, ventanas y puerta iluminada;
- árboles con sombra y faroles.

Se aplica en el visor (M4). En M1 `world:map` dibuja el mapa en la terminal con esta paleta, en la medida en que la terminal lo permita.

## Concepto A · Noche andina (alternativa)
Fondo `#10151F`, papel `#F4EFE6`, ámbar `#E3A72F`, verde cordillera `#3F8F6B`, azul Caribe `#2F6FB0` y arcilla `#C8643B`. Tipografías Space Grotesk, IBM Plex Sans e IBM Plex Mono. La marca es una "D" de 9 × 9 píxeles con una chispa ámbar.
