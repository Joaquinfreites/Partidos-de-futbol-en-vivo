# FIFA Live Tracker - Visualizador de Fútbol Real en Tiempo Real

Esta aplicación web te permite rastrear partidos de fútbol reales que se estén disputando en el mundo en tiempo real con estadísticas dinámicas, líneas de tiempo y escudos oficiales de los equipos. El programa se conecta directamente a la API pública de ESPN.

## Estructura de Archivos
- `index.html`: Estructura del panel de visualización, incluyendo el marcador principal, pestañas de estadísticas/eventos/plantel y panel de control.
- `style.css`: Estilos visuales con diseño responsivo premium, modo oscuro profundo y efectos translúcidos de *glassmorphism*.
- `app.js`: Lógica de conexión con la API de ESPN (con failover CORS), procesador de datos deportivos y simulación interactiva local (Modo Demo).

## Funciones Clave

1. **Datos Reales de ESPN API**: La aplicación consulta cada 20 segundos el endpoint de ESPN (`https://site.api.espn.com/apis/site/v2/sports/soccer/all/scoreboard`) para obtener resultados, minutos en juego, eventos y estadísticas en tiempo real.
2. **Escudos Reales en Alta Resolución**: La aplicación carga directamente los logotipos oficiales de los clubes y selecciones desde los servidores de ESPN.
3. **Paso Directo sobre CORS**: En navegadores web locales, el origen cruzado (CORS) suele bloquear llamadas directas a APIs de terceros. Por ello, el código incluye una pasarela de reintentos mediante un proxy CORS público (`https://api.allorigins.win/raw?url=...`), garantizando que la aplicación cargue los datos en cualquier computadora de manera inmediata y sin configuraciones previas.
4. **Modo Simulación de Demostración (Demo)**: 
   - Si abres la aplicación a una hora en la que no se estén disputando partidos en vivo en el mundo, la aplicación te permitirá ver la agenda de encuentros programados y terminados del día actual.
   - Cuenta con un botón para **"Cambiar a Modo Simulación Demo"**. Al activarlo, el programa simula un partido ficticio (ej. Argentina vs Francia) y habilita la **Consola de Control** para que puedas forzar goles, tarjetas o sucesos con animaciones instantáneas.

## Cómo Usar en tu Computadora

### Opción 1: Abrir Directamente en el Navegador
1. Abre tu Explorador de Archivos de Windows.
2. Navega a:
   `C:\Users\freit\.gemini\antigravity\scratch\fifa-live-tracker`
3. Haz doble clic sobre el archivo `index.html` para abrirlo en Chrome, Edge o Firefox. ¡Listo! La conexión se establecerá al instante.

### Opción 2: Correr un Servidor en VS Code
1. Abre VS Code en la carpeta del proyecto.
2. Instala la extensión **Live Server** si no la tienes.
3. Haz clic en el botón **"Go Live"** en la barra inferior derecha de VS Code. La página se cargará en `http://127.0.0.1:5500/` con actualizaciones automáticas en caliente.
