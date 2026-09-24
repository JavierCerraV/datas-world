---
description: Audita la cadena causal de un ciudadano o de todo el mundo
argument-hint: <CIT-xxxxxx | all>
---
Audita la causalidad para `$ARGUMENTS` según las specs 014, 019 y 020.

1. Carga el mundo actual (o genera uno de prueba con la semilla por defecto y avanza 90 días).
2. Para cada evento relevante del objetivo, verifica que `causes[]` no está vacío (salvo tipos marcados como espontáneos en la spec 014) y que todas las referencias existen y son anteriores en el tiempo.
3. Reconstruye 3 cadenas causales largas (profundidad ≥ 4) y muéstralas en texto legible.
4. Busca eventos "huérfanos", ciclos causales y causas que apunten al futuro.
5. Informa: % de eventos con causas, profundidad media, problemas encontrados y propuestas de corrección (en la spec o en el código). No modifiques código sin confirmación.
