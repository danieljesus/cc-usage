# Changelog

Todos los cambios notables de este proyecto se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el versionado, [SemVer](https://semver.org/lang/es/).

## [Unreleased]

## [0.1.0] - 2026-09-10

Primera release. Recoge todo el desarrollo desde el commit inicial (2026-09-05).

### Añadido

- Monitor NRT (poll cada 30 s) de las ventanas de uso de Claude Code: 5 h, 7 d y, cuando el plan los expone, Opus/Sonnet/créditos.
- Medidores coloreados verde→ámbar→rojo por posición absoluta en la escala 0–100 %, con hora y fecha de renovación y cuenta atrás.
- Sparkline y proyección de agotamiento por regresión lineal sobre el histórico local, con veredicto (margen / ajustado / agotas antes del reset).
- Lista de sesiones de Claude Code activas (`~/.claude/sessions/*.json`).
- Fuente primaria `GET /api/oauth/usage` con el token OAuth local; fallback al snapshot de la statusline; histórico en `~/.claude/usage-history.jsonl` podado a 7 días.
- Modo pantalla completa (buffer alternativo, como `vim`/`htop`) con restauración garantizada en todas las salidas: `q`, `Ctrl+C`, señales y errores no capturados.
- Teclas `q` (salir) y `r` (refrescar ya); fuera de una TTY real se desactivan solas y no se entra en pantalla completa.
- Tests de todos los módulos y componentes; scripts de captura de Windows Terminal real (bytes conpty) para depurar el redibujado.
- Fichero `LICENSE` (MIT).

### Corregido

- Leak de `perf_hooks`: sin `NODE_ENV` se cargaba el build de desarrollo de React 19, que emite un `performance.measure()` por render (~60/s con el tick de 1 s) hasta disparar `MaxPerformanceEntryBufferExceededWarning` a las ~4,5 h. El entry point fija ahora `NODE_ENV=production` antes de cargar Ink/React. ([#1](https://github.com/danieljesus/cc-usage/pull/1))
- Filas desplazándose en escalera con el tiempo: `.` y em-dash son *Ambiguous width* en Windows Terminal; el espacio icono-nombre lo calcula Ink en vez de ir literal.
- Borde roto al redimensionar: carrera entre el resize y el layout interno de Ink. El clear vive en `app.tsx`, después del repintado obsoleto de Ink.
- Dos iconos emoji rompían el propio buffer de Ink; el resto se restauraron.
- Fila de sesiones sin margen y sin la sangría del resto de sub-filas; icono de reset; techo de ancho innecesario.
- Proyección sobrerreactiva y estilos.
- Normalización defensiva del schema real de `/api/oauth/usage`.

### Cambiado

- Ink 7 + React 19 (el bug de espacio que se parcheaba localmente está arreglado upstream).
- Tooling a última versión: Node 26, TypeScript 7, vitest 5, biome 2.

[Unreleased]: https://github.com/danieljesus/cc-usage/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/danieljesus/cc-usage/releases/tag/v0.1.0
