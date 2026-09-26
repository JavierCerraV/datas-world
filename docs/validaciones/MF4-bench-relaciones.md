# bench:relations — valor funcional de un estímulo (037 CA-004)

200 personas con 500 relaciones al azar cada una; mediana y máximo de 10 consultas (estímulos distintos), después de 3 de calentamiento.

| Estímulos en la red | Aristas por estímulo | Mediana | Máximo | < 5 ms |
|---|---|---|---|---|
| 100 | 5.0 | 18.71 ms | 23.08 ms | ✘ |
| 250 | 2.0 | 3.22 ms | 11.10 ms | ✔ |
| 500 | 1.0 | 1.00 ms | 1.20 ms | ✔ |

**Nota (MF4).** CA-004 se cumple con redes de 250 estímulos o más (2 relaciones por estímulo o menos): 3,2 ms y 1,0 ms. Con una red muy densa (100 estímulos y 5 relaciones por estímulo) tarda 18,7 ms: hay unos 1 000 caminos de hasta 3 aristas por persona y el coste es combinatorio. Optimizaciones aplicadas sin cambiar el resultado: adyacencia en caché por arreglo de aristas, camino sin copias y poda de los caminos que no pueden transformar. En el mundo de MF4 cada persona tiene como mucho 2 relaciones enseñadas; la densidad realista con conversaciones (M3) y la historia sintética (MF7) queda por medir (PA-110).
