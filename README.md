# Los Santos a Dos

Servidor cooperativo para **dos jugadores en GTA V Legacy** con chat, garaje, trabajos, bandas, exploración y campaña. El anfitrión ejecuta FXServer en Windows. Ambos necesitan GTA V Legacy y el cliente [FiveM](https://docs.fivem.net/docs/getting-started/installing-fivem/).

**Versión candidata 0.10 · Atracos de Pillbox.** Hay 46 misiones fijas, un encargo diario y tres ofertas de incidentes en ruta que rotan cada 20 minutos. La validación dentro de FiveM Legacy sigue pendiente.

Para el primer arranque con dos clientes, seguid [la hoja de pruebas Legacy](PRUEBAS-LEGACY.md). En **F6 → Operaciones → Última ambulancia**, el rescatista localiza los civiles y confirma a pie; el conductor acerca la ambulancia y espera al volante. Tras la primera recogida podéis entregar en el hospital de Pillbox o intentar la segunda.

### Atracos cooperativos · 0.10

En **F6 → Atracos**, uno prepara el encargo y el otro se une en Pillbox. Confirmad ambos la salida. El anfitrión toma el primer papel. Intercambiad quién prepara la partida para probar el segundo.

| Atraco | Interacción | Pago por jugador |
| --- | --- | --- |
| Caja de cierre | Desde vuestros puestos en la tienda, un jugador dicta su secuencia por Teams y el otro pulsa los símbolos en el dial. | $1.350 + $650 opcionales |
| Cámara de ecos | Cada terminal muestra un tablero. Un jugador lee el eco y el otro lo introduce. Los papeles se alternan con cada acierto. | $2.700 + $1.250 opcionales |
| Proyecto Eclipse | En Zancudo, el piloto lee emblemas desde el Cargobob. El operador selecciona la carga desde la Handler. El piloto acopla el cable sobre la grúa con **E** desde la cabina. El operador embarca y ambos aterrizan en la entrega de LSIA. | $4.200 |

En la tienda y el banco, pulsa **E** en el puesto o abre **F6 → Cuartel general** para acceder a tu consola. Tras la primera caja podéis entregar o votar los dos por la extra. Un error cambia la combinación y consume diez segundos. Si se agota el tiempo antes de asegurar la base, el atraco termina sin pago. Si ya hay botín, volved juntos en el vehículo asignado a Pillbox para cobrar. La liquidación desglosa base y extra. En una desconexión individual, la alerta se pausa durante el periodo de reincorporación del compañero.

El selector de la vista previa local incluye las consolas de los tres atracos y ambos jugadores. Los tiempos del tablón son estimaciones. El posicionamiento en interiores, el manejo de la grúa y el vuelo con carga quedan pendientes de la prueba con dos clientes Legacy.

### Turnos de Pillbox · 0.9

- **Última recogida** está en **F6 → Operaciones**. Confirmad en la central. El copiloto usa la hoja de ruta de F6 para elegir o cambiar de comercio. El conductor detiene la furgoneta y el copiloto baja a recoger los bultos. Cada bulto vale $320 por persona. Podéis cerrar la ruta antes de tiempo y entregar lo recogido en el garaje. Una ruta vacía se cierra sin pago.
- **Guardacostas de Alamo Sea** sale de la misma mesa. El anfitrión toma el Maverick en Sandy Shores. El segundo jugador recoge la Dinghy en el lago. Una vez localizado el barco, el piloto conserva la referencia aérea para guiar al patrón por Teams. El patrón se acerca, detiene la lancha, embarca al náufrago y vuelve al embarcadero.
- **Una noche en Davis** está en **F6 → Mundo libre → Trabajo**. Elegid a quién ayudar y volved a visitar al mismo vecino tras cobrar. El servidor recuerda los favores en cada perfil. La siguiente salida usa los contactos del anfitrión.
- **F7** comparte durante 30 segundos vuestro destino del mapa o, si no hay destino, vuestra posición. **F9** consume el alimento asignado en la ficha de comida. Podéis reasignar ambas teclas en los ajustes de FiveM.
- En la ficha de un coche propio, guardad el modelo y su pintura favorita. **F6 → Cuartel → Salida habitual**, junto al garaje, muestra el precio de completar tres unidades del alimento favorito y prepara el vehículo. Las plazas de exposición enseñan los favoritos y la mesa muestra los recuerdos de campaña.
- El tablón indica jugadores, distancia al punto de inicio y duración estimada. Los tiempos son orientativos hasta medirlos en Legacy. La vista previa del navegador incluye **Hoja de ruta del dúo** y permite alternar conductor y copiloto.

### Incidentes en ruta

Abre **F6 → Exploración** para ver la oferta de Ciudad, Puerto y sur, y Blaine County. Puedes marcar el encuentro desde lejos. Al acercarte, acepta en el panel y deja que tu compañero se una en el mismo lugar antes de confirmar el primer objetivo.

En **Auxilio** y **Escolta**, el anfitrión conduce y su compañero confirma las etapas. En **Búsqueda**, el dúo recibe una pista de oeste a este y otra de sur a norte. También puedes completar cualquiera de las variantes en solitario.

El pago se entrega al cumplir el último objetivo en el destino. Después, el tablero destaca el incidente vigente más cercano que aún puedes cobrar. Si cambia la rotación, el encargo aceptado conserva su ruta y el compañero puede reincorporarse como en los demás contratos.

## Primera partida local

1. Genera una clave gratuita de servidor en el [portal de Cfx.re](https://portal.cfx.re/servers/registration-keys). Abre **Iniciar servidor.cmd** e introdúcela en el anfitrión cuando se solicite. El lanzador la guarda en `servidor/licencia.cfg`.
2. En el anfitrión, abre FiveM y ejecuta `connect 127.0.0.1:30120` en **F8**. Para una prueba en la misma LAN, el otro jugador usa `connect IP-LOCAL-DEL-ANFITRION:30120`. Windows muestra la IPv4 local con `ipconfig`.
3. Apareceréis junto a la central de Pillbox Hill. Abre el menú con **F6**. Uno inicia el contrato y el otro se une antes del primer objetivo. Cerrad el menú con **Esc**, seguid el GPS y usad **E** para confirmar cuando el juego lo indique.

El archivo `servidor/resources/duo/ui/index.html` también se puede abrir en un navegador para ver el menú con datos de ejemplo.

### Interfaz táctica 0.7

En **Garaje**, **Hangar** y **Suministros**, pulsad **Ver ficha** para consultar o usar cada artículo. La confirmación de compra muestra el precio y el saldo previsto. Los bocadillos y las barritas se guardan en la mochila y se pueden consumir desde **F6 → Suministros → Comida** para recuperar salud.

**F6** abre el resumen del cuartel. Si hay una misión activa, muestra quién está listo, el papel de cada uno, el objetivo personal y el tiempo restante. Cuando se guarda el pago, el cuartel muestra la última liquidación. Durante la partida, el HUD concentra el objetivo personal y las confirmaciones de equipo.

En **Operaciones → Ver ficha** podéis consultar la zona, el vehículo, los dos papeles y el pago individual antes de preparar la salida. El garaje, el hangar y el armero tienen filtros y explican qué falta para realizar cada acción.

En el navegador, los selectores de la parte inferior cambian el estado de **Doble baliza** y la perspectiva de cada jugador. Los estados sirven para revisar la invitación, la preparación, las balizas, la reconexión, el regreso y la liquidación.

En esa vista previa también puedes alternar **Menú F6**, **HUD a pie**, **HUD en coche** y **HUD en avión**. En el HUD puedes escoger los extremos de la zona segura y pulsar **Esc** para volver al menú.

- **Ajustes del HUD.** Desde F6 puedes elegir Completo o Compacto, escala, contraste alto y movimiento reducido. Las preferencias se guardan en el cliente.
- **Primera salida.** La pantalla de acceso muestra el progreso de FiveM. Tras aparecer, el cuartel ofrece una guía descartable con acceso al GPS. Puedes reabrirla desde **F6 → Ayuda**.
- **Pruebas offline.** La suite comprueba el foco, el paso de pie a coche y avión, los límites de telemetría, las confirmaciones simultáneas y el respaldo nativo. La vista previa permite revisar ambos papeles, el cronómetro y la liquidación sin conectarse.

La 0.7 pasó **23 pruebas automatizadas**. La geometría del HUD se revisó en Edge a 1280×720, 1920×1080 y 2560×1080 con los dos extremos de zona segura y una referencia simulada para los subtítulos. Con dos clientes reales, repasad la primera entrada, la legibilidad con el radar y el chat activos y el rendimiento del HUD bajo carga.

### Cuartel general de Pillbox Hill

La ampliación de flota añade ocho coches al garaje y cinco armas al almacén. Las armas compradas se guardan en tu perfil y se entregan con munición al reaparecer.

En **Mundo libre → Aviación** hay cuatro encargos con Cuban 800, Mammatus, Dodo y Maverick. Aceptad el encargo y uníos en el cuartel. El GPS os lleva a la aeronave en Sandy Shores o Grapeseed. En pareja, el piloto cruza el control y el copiloto confirma con **E** desde la aeronave. Si juegas solo, confirma desde el asiento del piloto. Para cobrar, aterrizad y detened la aeronave en el punto indicado. Las aeronaves están asignadas al encargo.

El tablón también ofrece **Repuestos de Blaine** y **Enlace de Mission Row**, dos trabajos terrestres con vehículos de la flota ampliada.

En el **Hangar de Sandy Shores**, marcado en el mapa, podéis comprar, pintar, guardar y recuperar estas cuatro aeronaves como vehículos personales. Usad **F6 → Hangar** o acercaos a pie y pulsad **E**. Cada jugador puede tener fuera un coche y una aeronave a la vez. La propiedad y la pintura se conservan al reiniciar.

**F6** abre el cuartel con el número de jugadores conectados y las plazas de salida disponibles. Desde ahí se accede a los trabajos, las dos campañas, el garaje, los suministros y la exploración.

- **Marcador azul.** El tablón abre los trabajos y permite unirse al encargo del compañero.
- **Marcador verde lima.** La mesa de operaciones abre la preparación de las misiones exclusivas del dúo.
- **Marcador dorado.** El garaje dispone de dos plazas de salida. Aquí se sacan, guardan, pintan y recuperan los coches de cada jugador.
- **Marcador verde.** El almacén vende el equipo de la próxima salida.

Acércate a pie y pulsa **E** para abrir la estación cuando no tengas un encargo activo. Durante un encargo, **E** confirma objetivos y **F6** sigue abriendo el menú.

### Operaciones para dos

Desde **F6 → Operaciones**, un jugador prepara la salida y el otro se une al contrato. Ambos pulsan **Confirmar salida** junto al tablón. En el menú podéis consultar vuestro papel y cuántas confirmaciones faltan. Volved los dos al cuartel para registrar y cobrar las operaciones terrestres. En Guardacostas, el cierre se hace en el embarcadero.

| Operación | Objetivo de equipo | Pago por persona |
| --- | --- | ---: |
| Doble baliza | Cada jugador confirma su baliza. Hay 25 segundos entre una confirmación y la otra. Si se agotan, se pueden repetir ambas. | $1.900 |
| Relevo nocturno | El jefe de la operación conduce el primer tramo. Cambiad de conductor para el segundo y confirmad los controles desde el asiento de copiloto. | $2.250 |
| Salida coordinada | El copiloto elige uno de los dos accesos al puerto y el equipo escolta una furgoneta hasta recepción. | $2.600 |

Si alguien se desconecta, la operación espera hasta cinco minutos a que vuelva con el mismo perfil. El registro de operaciones completadas es individual y se conserva al reiniciar.

## Partida privada desde redes distintas

1. Instalad [Tailscale](https://tailscale.com/download/windows) e iniciad sesión en ambos equipos. Desde la página de máquinas de Tailscale, el anfitrión comparte únicamente su PC con la cuenta del segundo jugador. El segundo acepta la invitación. [Cómo compartir un equipo](https://tailscale.com/docs/features/sharing)
2. En el control de acceso de Tailscale, concede a esa cuenta únicamente `tcp:30120` y `udp:30120` hacia la IPv4 Tailscale del anfitrión. Revisa las reglas más amplias que coincidan con el invitado y ese equipo porque los permisos se suman. Si Windows requiere una autorización entrante, crea dos reglas para `runtime\FXServer.exe`, una por protocolo, restringidas al puerto 30120, a la IPv4 Tailscale local y a la IPv4 Tailscale del invitado. El router puede conservar su configuración. [Sintaxis de permisos de Tailscale](https://tailscale.com/docs/reference/syntax/grants)
3. Si aún no tenéis los dos identificadores `license:`, cierra cualquier FXServer abierto y ejecuta en PowerShell `& '.\Iniciar remoto.cmd' -Registrar`. Introduce la IPv4 del invitado tal como aparece desde Tailscale en el **anfitrión**. El perfil de registro admite el anfitrión por loopback y el invitado por esa IP de la VPN. Conectaos usando las direcciones del paso siguiente, ejecuta `duo_identificadores` en la consola de FXServer y apunta los dos identificadores en el anfitrión. Cierra ese servidor al terminar.
4. Abre **Iniciar remoto.cmd** normalmente. La primera vez pide los dos identificadores. Se guardan en `servidor/jugadores.cfg`. El anfitrión usa `connect 127.0.0.1:30120` en F8. El invitado usa `connect IP-TAILSCALE-DEL-ANFITRION:30120` con la dirección que muestra **su** Tailscale para el equipo compartido.
5. Para diagnosticar la conexión, confirma primero que FXServer acepta al anfitrión. Desde el invitado, comprueba el acceso TCP con `Test-NetConnection IP-TAILSCALE-DEL-ANFITRION -Port 30120` y después entra con FiveM para comprobar la conexión de juego. Si el juego llega al servidor y rechaza la cuenta, revisa los dos identificadores en `servidor/jugadores.cfg` y reinicia.

El lanzador remoto comprueba la IPv4 local de Tailscale y liga FXServer a esa IP y a loopback. El acceso habitual queda limitado a las dos licencias autorizadas. La clave y los identificadores son locales al anfitrión.

## Campaña y mundo libre

Abre **F6 → Campaña** para elegir la historia y ver sus capítulos. El anfitrión de cada misión necesita tener su capítulo desbloqueado. Su compañero puede ayudar y cobrar. Para que la misión cuente en el progreso de ambos, cada uno debe tener disponible ese capítulo.

### Primera campaña

| Capítulo | Misiones |
| --- | --- |
| La central | Carga urgente y Avería nocturna |
| El puerto | Contenedor 17 y Salida de la terminal |
| La ruta del desierto | Puesto perdido y Relevo en Sandy Shores |
| El último encargo | Cruce de Davis y Último turno |

En los puntos de búsqueda, el mapa muestra todas las ubicaciones aún por inspeccionar. En el relevo, el copiloto confirma desde el coche y ambos intercambian asiento antes del siguiente control. Si uno se desconecta en mitad de una misión, puede reincorporarse con la misma cuenta durante los siguientes cinco minutos mientras el otro permanece en el contrato.

### Frecuencia fantasma

Esta historia se desbloquea al completar la primera campaña. Cada jugador conserva su avance. Tras completar las doce misiones, el garaje habilita la pintura **Frecuencia**.

| Capítulo | Misiones |
| --- | --- |
| La llamada | Turno interrumpido, Ecos de Vespucci y El pasajero de madrugada |
| Marea baja | Dos muelles, La furgoneta gemela y Contrapeso |
| Fuera de cobertura | Tres balizas, Camino de sal y Último relevo |
| Volver al aire | La prueba, Dos destinos y Frecuencia fantasma |

Las introducciones y los subtítulos dan el contexto de cada encargo. Compartid las pistas que reciba cada jugador. Los objetivos separados se pueden confirmar en paralelo en dúo o uno tras otro en solitario. En las etapas de rutas alternativas, seguid uno de los puntos marcados. Las dos rutas del final permiten cerrar la historia, y se puede repetir el encargo para probar la otra.

Cuando una misión larga haya guardado un punto intermedio, consulta **F6 → Campaña** para ver si puedes reintentar desde allí. El último punto seguro se guarda en el perfil del anfitrión. Tras salir ambos o reiniciar el servidor, el anfitrión puede elegir **F6 → Cuartel → Reanudar en Pillbox**. Si jugaban dos personas, el compañero original se une en el cuartel. Cancelar el contrato descarta ese punto. El pago y el avance permanente se guardan al cerrar el encargo.

### Contratos y exploración

Los comandos clásicos siguen disponibles en el chat (**T**). En F8 se escriben sin la barra inicial.

| Comando | Actividad | Pago base por jugador |
| --- | --- | ---: |
| `/mensajeria` | Recogida y entregas urbanas | $420 |
| `/taxi` | Traslado de un NPC. Dejad libre el asiento trasero derecho | $550 |
| `/taller` | Herramientas y asistencia en Mirror Park | $680 |
| `/costa` | Reparto de material de salvamento de Vespucci a Chumash | $960 |
| `/puerto` | Recuperación de carga en territorio de Los del Puerto | $1.050 |
| `/rural` | Suministros para Grapeseed y el aeródromo | $1.220 |
| `/barrio` | Expedientes en zonas de Ballas y Families | $1.250 |
| `/rally` | Vuelta a Vinewood. Cinco controles y cuatro minutos desde la salida | $1.350 |
| `/desierto` | Envío a Sandy Shores y encuentro con Lost MC | $1.600 |
| `/nocturno` | Repuestos robados y dos encuentros con los Vagos | $1.850 |

El contrato destacado rota a medianoche UTC y añade un 25 % al pago. En Vinewood, confirma los controles con **E** desde el coche de rally. La marca personal se guarda al devolverlo. También puedes usar `/unir`, `/cancelar` y `/saldo`.

- **Garaje.** Acércate al marcador dorado y abre F6. El Blista es gratuito. También hay Sultan, Dominator, Elegy RH8, Sandking XL, Comet, Kuruma y Jester. Cada coche admite los cinco colores de catálogo y la pintura de campaña al desbloquearla. Puedes marcar tu coche en el GPS desde F6 y recuperarlo en el garaje si se destruye. Para cambiar de coche, devuelve el actual y baja de él antes de guardarlo.
- **Suministros.** El marcador verde vende chaleco, botiquín y carabina. Cada jugador empieza con $500 y una pistola. La curación y el blindaje son consumibles.
- **Exploración.** En F6, abre **Exploración** y marca la zona del alijo. Busca dentro del área y pulsa **G** al acercarte. Paga $350 por jugador y se reclama una vez al día.
- **Evento diario.** Desde la central, usa **F6 → Exploración** para aceptar un encargo de auxilio, búsqueda o escolta. Hay tres zonas por tipo. La oferta cambia a medianoche UTC y se puede repetir mientras esté disponible. Podéis completarla en pareja o en solitario. Solo puede haber un encargo activo por equipo.

## Copia y restauración de progreso

Cierra FXServer antes de respaldar, actualizar o restaurar. Abre PowerShell en la carpeta del proyecto.

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\Respaldar progreso.ps1'
```

La copia queda debajo de `respaldos` e incluye perfiles y pagos pendientes, con un manifiesto de comprobación. Conserva la carpeta completa. Para restaurar una copia, sustituye el nombre de ejemplo por el de tu carpeta:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File '.\Respaldar progreso.ps1' -Restaurar '.\respaldos\progreso-FECHA-ID' -Confirm
```

El script valida los archivos y hace otra copia del progreso actual antes de reemplazarlo. `-WhatIf` permite previsualizar la operación. Conserva `servidor/licencia.cfg` y `servidor/jugadores.cfg` aparte en el anfitrión si necesitas reinstalar.

## Comprobación con los dos clientes

**Prueba local sin clave.** Abre `Probar servidor.cmd` o ejecuta `node --test pruebas/duo.test.cjs` desde el proyecto con Node.js 20 o posterior. La suite de regresión utiliza perfiles temporales. Para revisar la interfaz en el navegador, abre `servidor/resources/duo/ui/index.html`.

1. Verifica el arranque local y después la conexión desde otra red con el perfil remoto.
2. Completad la primera campaña y abrid Frecuencia fantasma. En La llamada, comprobad los subtítulos, la recogida del pasajero y las pistas por jugador. Confirmad que el solitario también permite resolver las pistas.
3. Probad un reintento desde un punto intermedio, las dos rutas del final y un evento de cada tipo. Comprobad GPS, NPC, reparto de tareas, pagos y reincorporación tras una desconexión.
4. Probad mensajería, taxi, rally y un contrato de bandas. Comprad y pintad un coche y comprobad su recuperación.
5. Reinicia FXServer, volved a entrar y verificad ambas campañas, el saldo, el garaje, la pintura Frecuencia y el récord de rally.

Hasta que se prueben estos pasos con la clave y los dos clientes, la conexión remota y el comportamiento dentro de GTA quedan pendientes de validación.

## Recursos

- Vehículos del [catálogo nativo de GTA V en FiveM](https://docs.fivem.net/docs/game-references/vehicle-references/vehicle-models/).
- Barlow Condensed de [The Barlow Project Authors](https://github.com/google/fonts/tree/main/ofl/barlowcondensed), con su licencia en `servidor/resources/duo/ui/OFL.txt`.
- Portada original de la central e ilustraciones originales de capítulo. Chat y gestor de aparición de Cfx.re.
