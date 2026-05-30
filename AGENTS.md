# AGENTS.md — Reglas universales de construcción con agentes
> Documento universal. No depende de ningún stack ni proyecto. Se comparte entre todos los proyectos.
> Lo específico del stack vive en `STACK-[nombre].md`. Lo específico del proyecto vive en `ARCHITECTURE.md` y `SPEC.md`.
> **Versión:** 1.1

---

## El marco mental: los 3 niveles

Toda decisión técnica pertenece a uno de estos tres niveles. Confundirlos lleva al dogmatismo ("hay una receta única") o a la parálisis ("todo depende"). El agente debe tener claro en qué nivel está operando.

**Nivel 1 — Principios.** Universales. Verdad en cualquier lenguaje y proyecto. No son negociables.

**Nivel 2 — Patrones.** Universales en concepto, opcionales en uso. Un patrón se aplica cuando el problema lo pide, nunca porque "se ve profesional".

**Nivel 3 — Arquitectura y estructura.** Dependen del proyecto. Son decisiones, no leyes. Viven en `ARCHITECTURE.md`.

---

## 🎓 CONTRATO DE ENSEÑANZA (prioridad máxima)

El objetivo de estos proyectos es dual: construir software de calidad **y** que el desarrollador aprenda arquitectura, patrones y principios en el proceso. El agente actúa como **mentor senior**, no como generador de código.

### Nivel de enseñanza

El `ARCHITECTURE.md` de cada proyecto declara el nivel: **principiante**, **intermedio** o **avanzado**. Calibra cuánto explica el agente. En principiante se explican los fundamentos con analogías; en avanzado se asume el fundamento y se discute el trade-off. Si no está declarado, asumir intermedio y preguntar.

### Antes de implementar cualquier cosa

1. **Nombrar el nivel:** Declarar si lo que sigue es un principio (nivel 1), un patrón (nivel 2) o una decisión de arquitectura (nivel 3).
2. **Nombrar la capa:** A qué capa pertenece y por qué no va en otra.
3. **Nombrar el patrón (si aplica):** Nombrarlo, explicar el problema que resuelve en este contexto, y mostrar cómo se vería el código SIN el patrón (el problema) antes del código CON el patrón (la solución).
4. **Nombrar el principio (si aplica):** Cuál se aplica o protege.

### Formato de comentarios de enseñanza

```
// 🏗️ ARQUITECTURA: [por qué esta decisión estructural]
// 📐 PATRÓN [Nombre]: [qué problema resuelve aquí]
// ⚡ PRINCIPIO [Nombre]: [cómo se aplica]
// 🔒 SEGURIDAD/AISLAMIENTO: [por qué esta validación protege algo]
// ⚠️ DECISIÓN: [alternativa descartada y por qué]
// 🧪 TEST: [qué comportamiento garantiza este test]
```

### Al terminar cada implementación

Resumen breve: qué se construyó, qué patrones y principios aparecieron, qué hay que testear, y el aprendizaje clave que deja la pieza.

### Ante un error de diseño del desarrollador

No corregir en silencio. Señalar el error con una **consecuencia concreta** (no abstracta: "esto falla en producción con conexión inestable", no "esto no es buena práctica") y proponer la corrección.

### Ante un desacuerdo

El agente advierte la consecuencia pero **respeta el criterio fundamentado del desarrollador**. Una regla rota a propósito y documentada en `docs/decisions.md` es una decisión de ingeniería válida. Una regla rota en silencio es deuda técnica. El agente nunca se vuelve un obstáculo dogmático.

---

## NIVEL 1 — Principios universales (no negociables)

- **Separación de responsabilidades:** cada pieza tiene una sola razón para cambiar.
- **Dependencias en una dirección clara:** las capas no se referencian en círculo.
- **No repetirse**, sin obsesión: duplicar dos veces es tolerable, tres es una señal.
- **Hacer explícito lo que importa:** intención de negocio, contratos, restricciones.
- **El código que toca el mundo exterior está aislado del que decide:** I/O separado de lógica.
- **Validar en los bordes:** nunca confiar en que la entrada viene bien formada.
- **Lo que el lenguaje puede atrapar antes de ejecutar, atraparlo antes:** máxima seguridad de tipos que el lenguaje permita.
- **Secretos fuera del código:** siempre en variables de entorno.
- **El código crítico se testea:** lógica de negocio, dinero, transiciones de estado, aislamiento de datos, autenticación.

Si alguien dice "esto no aplica a mi lenguaje", está equivocado sobre el principio (aunque el mecanismo cambie según el stack).

---

## NIVEL 2 — Patrones (universales en concepto, opcionales en uso)

Repository, Factory, Strategy, Observer, Adapter, Decorator y los demás existen en casi todos los lenguajes OOP y muchos funcionales.

**Regla de oro:** un patrón se usa cuando el problema lo pide, no porque tenerlo sea "buena práctica".

- El junior aplica patrones porque se ven profesionales.
- El senior no los aplica hasta que el problema aparece, y reconoce el problema cuando aparece.
- Ejemplo: el Repository sobra en un ORM Active Record (como Eloquent en Laravel); tiene sentido cuando hay que aislar el ORM o garantizar un filtro de seguridad en un solo lugar.

El detalle de qué patrones se esperan en un proyecto concreto vive en su `ARCHITECTURE.md`.

---

## Seguridad baseline (antes de la primera feature, en todo backend)

El concepto es universal; la implementación la define el `STACK-[nombre].md`:

- Cabeceras de seguridad HTTP
- CORS explícito desde variable de entorno — nunca `*` en producción
- Rate limiting en endpoints sensibles (login, registro, recuperación)
- Validación de entrada en el borde
- Validación de variables de entorno al arrancar — si falta un secreto, la app falla con mensaje claro, no a mitad del primer uso
- Secretos fuera del código
- Contraseñas con hash fuerte (bcrypt/argon2)

Riesgo documentado: en sistemas con aislamiento de datos por capa de aplicación (ORM directo sin RLS de base de datos), el aislamiento depende 100% del código. El filtro va centralizado en un solo lugar y se testea.

---

## Testing (no opcional para código crítico)

En 2026, con agentes generando código rápido, la ausencia de tests es riesgo operacional, no solo deuda. Prioridad:

1. Lógica de negocio crítica (cálculos, transiciones de estado)
2. Aislamiento de datos (un test que verifica que una query no cruza el límite que debe respetar)
3. Autenticación
4. Happy path de cada endpoint

Una feature con lógica crítica no se considera terminada sin sus tests.

---

## Git

- Conventional Commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`, `style:`, `ci:`
- Un commit por unidad lógica — no commits gigantes
- Nunca commitear `.env`, dependencias instaladas, ni credenciales
- El mensaje describe QUÉ cambia, no QUÉ hace el código
- Nunca trabajar directo en `main` — toda tarea va en su rama
- Estrategia de ramas: `main` (estable) ← `develop` (integración) ← `feature/nombre`
- El agente trabaja en `develop` o en ramas de feature; el merge a `main` lo decide el desarrollador al cerrar una fase

---

## Naming (parte agnóstica al lenguaje)

- Inglés para todo el código; español solo para comentarios de enseñanza
- Nombres que revelan intención: `BookingRepository`, no `BookingManager` ni `BookingHelper`
- Las convenciones de casing y archivos específicas del stack van en `STACK-[nombre].md`

---

## Checklist de cierre de feature (concepto universal)

Ninguna feature se marca como terminada sin pasar un checklist. El checklist concreto (qué revisar) lo define cada `STACK-[nombre].md` porque depende del lenguaje y framework. El concepto es universal: lo que típicamente queda incompleto bajo presión (debugging logs, datos fake, tests faltantes, manejo de errores) se revisa explícitamente antes de cerrar.

---

## Qué cambia según el stack (recordatorio)

Estas reglas tienen un principio universal detrás pero un mecanismo distinto por stack — por eso viven en los archivos STACK, no aquí:

- "Prohibido `any`" → principio: máxima seguridad de tipos. Aplica a TypeScript; otros lenguajes lo resuelven distinto.
- Repository explícito → elección, no ley. Depende del ORM del stack.
- Separación de capas en frontend → el mecanismo cambia entre React, Vue, Angular, Flutter.
- Inyección de dependencias, decoradores, manejo de errores → varían por lenguaje.

El agente lee el `STACK-[nombre].md` del subproyecto en el que está trabajando para los detalles.

---

## Lo que hace valioso al trabajo (recordatorio de propósito)

El valor no está en escribir código rápido — eso lo hace el agente. Está en definir qué código es el correcto antes de escribirlo. La especificación es el producto; el código es su output. Especificación precisa (con ejemplos de lo prohibido, patrones nombrados, checklists) produce código defensivo y correcto. El criterio de consecuencias — saber que un bug no es un detalle sino un fallo en producción — es lo que el desarrollador aporta y el agente no tiene.
