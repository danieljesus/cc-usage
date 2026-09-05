# cc-usage

Monitor NRT (refresco cada 30s) de las ventanas de uso de Claude Code — 5 horas y semanal — para no tener que ir saltando entre terminales para ver cuánta cuota queda y cuándo se renueva.

```
pnpm install
pnpm build
npm link      # deja `cc-usage` en el PATH
cc-usage
```

## Qué muestra

- Medidores de las ventanas de 5h y 7d (y Opus/Sonnet/créditos cuando el plan los expone), coloreados verde→ámbar→rojo por posición absoluta en la escala 0–100%.
- Hora y fecha de renovación de cada ventana, y cuenta atrás.
- Sparkline y proyección de agotamiento (regresión lineal sobre el histórico local) con veredicto: llegas con margen / ajustado / agotas antes del reset.
- Sesiones de Claude Code activas ahora mismo (`~/.claude/sessions/*.json`).

`cc-usage` toma la pantalla completa (buffer alternativo, como `vim`/`htop`): el propio comando desaparece de la vista y al salir vuelves exactamente a donde estabas en el shell. `q` sale, `r` refresca ya. Fuera de una TTY real (pipe, wrapper) el teclado se desactiva solo y no se activa la pantalla completa; `Ctrl+C` siempre corta.

## De dónde salen los datos

- **Fuente primaria**: `GET https://api.anthropic.com/api/oauth/usage` con el token OAuth de `~/.claude/.credentials.json` — el mismo endpoint que consulta `/usage` dentro de Claude Code. Es un endpoint de cuenta, no de inferencia: no consume tokens ni cuenta contra ninguna ventana de cuota.
- **Fallback**: `statusline-command.py` (ver `~/.claude/statusline-command.py`) vuelca `rate_limits` a `~/.claude/usage-snapshot.json` en cada render de la statusline. Si el poll a la API falla, `cc-usage` cae a este snapshot.
- **Histórico**: `~/.claude/usage-history.jsonl`, un punto por cambio de valor (no por poll), podado a los últimos 7 días en cada arranque.

El endpoint de `/usage` no está documentado y puede cambiar entre versiones de Claude Code; la normalización en `src/data/usage-api.ts` es defensiva a propósito.
