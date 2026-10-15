# AGENTS.md - Contexto y Arquitectura de Brain Board

Consulta la documentación completa y detallada en [GEMINI.md](file:///c:/Users/Usuario/Desktop/DEV/BrainBoard/GEMINI.md).

### Resumen Rápido para Agentes de IA:
- **Directorio de trabajo:** `c:\Users\Usuario\Desktop\DEV\BrainBoard` (SIEMPRE usar este directorio, no `DEV\Miro`).
- **Arrancar app:** `npm start` (ejecuta Electron cargando `app_bundle/`).
- **Empaquetar app:** `npm run build` (genera `dist/app.asar`).
- **Caché de IndexedDB y Seed Version:** Si modificas archivos en `boards/*.json`, incrementa `"seedVersion"` para que `board_app.js` purgue la caché local automáticamente.
- **Aislamiento RTB:** Cada tablero solo puede utilizar los archivos multimedia de su propio `.rtb` catalogados en `scripts/rtb_files_by_board.json`.
- **Mapeo de imágenes:** Gestionado por `scripts/apply_all_mappings.js` comparando cabeceras binarias contra `mapping_images/` y permitiendo reutilización de imágenes duplicadas.
- **Creación de nuevos tableros curados:** Consultar siempre [BoardInstructorAI.md](file:///c:/Users/Usuario/Desktop/DEV/BrainBoard/BoardInstructorAI.md) para cumplir con las directrices visuales (paleta gris/negro/gris azulado, proporción comedida de widgets, estructuración en marcos, sin flechas por defecto y acompañamiento imagen-texto).
