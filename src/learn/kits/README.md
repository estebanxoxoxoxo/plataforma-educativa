# kits — libs de interacción reusables (opt-in)

El nivel del medio entre el **núcleo** (`src/activity/`: contratos, ciclo de
vida, scoring, bus de eventos, marco, motores de audio/efectos) y las
**actividades** (`src/activities/<x>/`: mecánica + tema + assets propios).

Un kit encapsula un patrón de interacción con su *feel* compartido, para no
reconstruirlo en cada actividad: el "cómo se manipula" es común, el "qué/arte"
queda en la actividad. Ejemplos previstos: `DragDropKit`, `CardsKit`,
`ChoiceKit`, `ManipulablesKit`, `VideoChatKit`, `CodeKit`.

Disciplina: **un kit nace cuando el patrón se repite** (o es claramente
inminente), no especulativamente — así las libs salen probadas, no inventadas.
Toda actividad importa solo los kits que usa, y los kits respetan las
meta-definiciones de estilo (tokens, motion, eventos) del núcleo.

(Primer kit a extraer: `DragDropKit`, con el dominó de fichas arrastrables.)
