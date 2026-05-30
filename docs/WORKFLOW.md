# Vetary — Workflow de Desarrollo
**Autor:** Javier Rojas  
**Fecha:** Mayo 2026  
**Propósito:** Definir las dos "salas" del proceso de desarrollo y cuándo usar cada una.

---

## Las dos salas

Este proyecto se desarrolla en dos contextos distintos con propósitos distintos.
Mezclarlos genera ruido, decisiones apresuradas y aprendizaje superficial.

---

## 🧠 Sala Estratégica — Claude en chat (claude.ai)

### Para qué sirve
- Tomar decisiones de arquitectura antes de implementarlas
- Entender un patrón de diseño antes de que el agente lo codifique
- Revisar el trabajo al cierre de cada fase
- Resolver dudas conceptuales ("¿debería usar X o Y?")
- Definir el alcance de features nuevas o cambios
- Detectar errores de diseño antes de que se propaguen
- Redefinir documentos base (SPEC, ARCHITECTURE, AGENTS.md)

### Cuándo venir acá
- Antes de arrancar una fase nueva
- Cuando algo no te cierra conceptualmente
- Cuando el agente propone algo y no entendés por qué
- Cuando terminás una fase y querés confirmar que está bien cerrada
- Cuando querés entender la teoría detrás de lo que acabás de construir
- Cuando el agente toma una decisión que no estaba en los documentos

### Regla de oro
> Si la pregunta empieza con **"¿debería...?"** o **"¿por qué...?"** → Sala Estratégica.

### Cómo traer contexto acá
Cuando vengas a esta sala con una duda específica, traé:
1. En qué fase del proyecto estás
2. Qué acabás de construir o intentar construir
3. La duda concreta (código, decisión, concepto)

No es necesario pegar todo el código. Con el contexto puntual es suficiente.

---

## 🏗️ Sala de Construcción — Pi/OpenCode en terminal (WSL)

### Para qué sirve
- Implementar lo que ya está decidido en los documentos
- Aprender los patrones mientras se construye (el agente explica al codificar)
- Ejecutar el ciclo SDD completo por feature
- Hacer commits, correr tests, gestionar el repositorio
- Resolver errores técnicos de implementación

### Cuándo quedarse acá
- Cuando la feature o tarea ya está definida y aprobada
- Cuando la duda es "¿cómo implemento esto?" (no "¿debería implementarlo?")
- Cuando es un error técnico (sintaxis, bug, test roto)
- Cuando el agente está en medio de una fase SDD — no interrumpir

### Regla de oro
> Si la pregunta empieza con **"¿cómo implemento...?"** o **"¿qué hace este error?"** → Sala de Construcción.

### Qué hacer si el agente propone algo fuera del SPEC
No avanzar. Frenar al agente con:
> "Eso no está en el SPEC/ARCHITECTURE. Antes de continuar, quiero consultarlo."

Luego venir a la Sala Estratégica con la propuesta del agente y evaluar si corresponde agregarla.

---

## 🔄 Cómo traspasar contexto entre salas

### De Construcción → Estratégica
Al terminar una sesión de construcción o al cerrar una fase, actualizar `CONTEXT.md` en la raíz con:

```markdown
# CONTEXT.md — Estado actual del proyecto
**Última actualización:** [fecha]

## Fase actual
[número y nombre]

## Último hito completado
[descripción concisa]

## Lo que acaba de construirse
[módulo, feature, o componente]

## Decisiones tomadas en esta sesión
[lista de decisiones que no estaban en los documentos originales]

## Próximo paso
[qué viene a continuación, con suficiente detalle para retomar sin releer todo]

## Dudas abiertas
[preguntas que quedaron sin resolver, para la Sala Estratégica]
```

### De Estratégica → Construcción
Cuando vengas de tomar una decisión acá, llevá al agente:
1. El documento actualizado (si se modificó SPEC o ARCHITECTURE)
2. Un mensaje explícito: *"Tomé la decisión de X. Implementemos Y siguiendo el AGENTS.md."*

---

## 📋 Checklist de cierre de fase

Antes de declarar una fase como terminada y avanzar a la siguiente,
confirmá estos puntos en la Sala Estratégica:

- [ ] Los criterios de aceptación definidos en SPEC.md están cumplidos
- [ ] El agente explicó cada patrón de diseño que apareció en esta fase
- [ ] No hay queries sin filtro de `tenantId` en el código nuevo
- [ ] Los commits siguen Conventional Commits
- [ ] No hay `any` sin justificación en TypeScript
- [ ] El código fue revisado en la Sala Estratégica y aprobado

---

## 🗺️ Mapa de fases y progreso

| Fase | Descripción | Estado | Sala actual |
|------|-------------|--------|-------------|
| 1 | Auth + Multi-tenancy | ⬜ Pendiente | 🏗️ Construcción |
| 2 | Configuración de la clínica | ⬜ Pendiente | — |
| 3 | Sistema de reservas | ⬜ Pendiente | — |
| 4 | Ficha clínica | ⬜ Pendiente | — |
| 5 | Dashboard + UI final | ⬜ Pendiente | — |
| 6 | Deploy | ⬜ Pendiente | — |

Actualizar este mapa al cerrar cada fase.

---

## Estructura de repositorios

```
vetary/
├── vetary-api/          # Backend NestJS
│   ├── SPEC.md          ← copia (o symlink)
│   ├── ARCHITECTURE.md  ← copia (o symlink)
│   ├── AGENTS.md        ← copia (o symlink)
│   └── src/
│
├── vetary-web/          # Frontend React
│   ├── SPEC.md          ← copia (o symlink)
│   ├── ARCHITECTURE.md  ← copia (o symlink)
│   ├── AGENTS.md        ← copia (o symlink)
│   └── src/
│
└── docs/                # Documentación compartida
    └── WORKFLOW.md      ← este archivo
```

> Los tres documentos base (SPEC, ARCHITECTURE, AGENTS.md) van en la raíz
> de cada repositorio para que el agente los encuentre al abrir el proyecto.
> El agente trabaja en un repo a la vez — primero el backend, luego el frontend.

---

*Documento vivo — actualizar cuando el proceso cambie.*
