# Incidente 2026-09-07 — Caída del backend en producción

> **Estado:** servicio restaurado (reboot a las 14:37 ART). Causa raíz identificada.
> **Mitigaciones:** ninguna aplicada todavía. Ver [Plan de mitigación](#plan-de-mitigación).
>
> Este documento está escrito para que otra sesión de Claude Code, en otra notebook,
> pueda retomar el trabajo sin contexto previo. Incluye el detalle de infraestructura,
> los accesos, la evidencia recogida y los comandos exactos usados.

---

## 1. Resumen ejecutivo

El backend de AMSA Sender estuvo **caído ~40 minutos** (14:00 a 14:37 ART del 2026-09-07).
El frontend cargaba pero ninguna llamada a la API respondía: los usuarios veían la pantalla
vacía o un spinner infinito.

**Causa raíz:** la creación de campañas de email corre el import completo del CSV **dentro del
proceso de la API**. Dos campañas creadas con 24 segundos de diferencia agotaron el heap de
Node (techo de 2096 MB) y el proceso entró en **espiral de garbage collection**: quedó girando
al 100% de un core, sin avanzar y sin responder nada, durante 36 minutos.

**Problema secundario, independiente y preexistente:** el health check del ALB **nunca funcionó**.
Apunta a un endpoint que no existe y viene devolviendo 404 desde siempre. Por eso no saltó
ninguna alarma y nos enteramos porque avisaron los usuarios.

---

## 2. Mapa de infraestructura

Todo está en AWS, cuenta **`592943773890`**, región **`us-east-1`**.

### Frontend
- **S3 + CloudFront**, dominio `amsasender.anamayasa.com`
- Deploy automático por GitHub Actions: [.github/workflows/deploy-frontend.yml](../../.github/workflows/deploy-frontend.yml)
- **No estuvo afectado.** Durante todo el incidente respondió 200.

### Backend
| Recurso | Valor |
|---|---|
| Instancia EC2 | `i-031266d1bcb22feec` — Name: **`amsa-backend`** |
| Tipo | `t3.large` (2 vCPU, 7,6 GB RAM), AZ `us-east-1c` |
| IP pública / privada | `54.242.1.23` / `172.31.22.59` |
| Instance profile | `ec2-backend-ssm-role` |
| Security group | `sg-0d985b9b328fd0ba8` (`ec2-backend-amsa-sender`) |
| ALB | `amsa-api-alb` → `api.amsasender.anamayasa.com` |
| Target group | `amsa-backend-gd`, puerto **80**, health check **`/health`**, timeout 5s, interval 30s, unhealthy threshold 2 |
| TG ARN | `arn:aws:elasticloadbalancing:us-east-1:592943773890:targetgroup/amsa-backend-gd/bd6f81a46dfe4d55` |
| Build | CodeBuild `amsa-backend-build`, disparado por webhook de GitHub |

> ⚠️ **No confundir con `amsa-gestion-backend`** (`i-09f8d6ff1ae9d99e1`), que es otro proyecto
> y tiene su propio ALB (`amsa-gestion-alb`) y su propio target group (`amsa-gestion-tg`).

### Contenedores en la instancia
```
amsa-backend-1          # proceso principal de la API NestJS (PID 19 adentro)
amsa-worker-1           # worker BullMQ WhatsApp
amsa-emailworker-1      # worker BullMQ Email
amsa-wapiworker-1       # worker BullMQ WhatsApp API
amsa-reportesworker-1   # worker BullMQ Reportes
amsa-redis-1            # Redis (BullMQ)
amsa-nginx-1            # reverse proxy, expone :80
dozzle                  # visor de logs, expone :7000
```

> El `docker-composeee.yml` que está en la raíz del repo **está desactualizado** — describe un
> stack viejo con `nginx-proxy` + `acme-companion`. La instancia real corre el stack de arriba.
> El compose vigente vive en la instancia, no en el repo.

---

## 3. Cómo obtener acceso

### AWS CLI
En la notebook donde se hizo este diagnóstico quedó configurado el perfil **`amsa`**
(`~/.aws/credentials`, usuario IAM `amsa-sender-deploy`, permisos `AdministratorAccess`).

**Desde otra notebook hay que configurarlo de cero** — las credenciales no se sincronizan.
Instalación sin sudo:

```bash
curl -s "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
cd /tmp && unzip -q -o awscliv2.zip
./aws/install --install-dir "$HOME/.local/aws-cli" --bin-dir "$HOME/.local/bin" --update
```

```ini
# ~/.aws/config
[profile amsa]
region = us-east-1
output = json
```

Verificar: `AWS_PROFILE=amsa aws sts get-caller-identity`

### Acceso a la instancia: SSM, no SSH

**SSH no es una opción viable:**
- El puerto 22 del SG está restringido a `190.16.88.238/32` únicamente
- La instancia **no tiene key pair asociada** (`KeyName: null`)

Se entra por **SSM Run Command**:

```bash
export AWS_PROFILE=amsa PATH="$HOME/.local/bin:$PATH"
aws ssm send-command \
  --instance-ids i-031266d1bcb22feec \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker ps","free -m"]' \
  --query 'Command.CommandId' --output text

aws ssm get-command-invocation \
  --command-id <ID> --instance-id i-031266d1bcb22feec \
  --query 'StandardOutputContent' --output text
```

#### Gotchas encontrados (ahorran tiempo)

1. **Comandos complejos**: si el shell tiene comillas, `sed`, o regex, el escapeo inline de
   `--parameters` falla. Escribir un JSON a archivo y usar `--parameters file://cmd.json`:
   ```json
   { "commands": ["echo hola", "docker logs amsa-backend-1 | tail -5"] }
   ```
2. **`aws ssm list-commands --query 'Commands[0].CommandId'` devuelve `None`** de forma
   inconsistente. Listar con `--query 'Commands[].{Id:CommandId,Status:Status}'` y copiar el ID.
3. **Zona horaria**: el SO de la instancia corre en **UTC**, pero los logs de Nest imprimen en
   **ART (UTC-3)**. Los flags `--since`/`--until` de `docker logs` usan UTC.
   Un evento que el log muestra como `2:01 PM` se filtra con `--since 2026-09-07T17:01:00`.
4. **Límite de salida**: `get-command-invocation` trunca a ~24.000 caracteres. Filtrar con
   `head`/`tail`/`grep` del lado de la instancia, no del lado local.
5. **Códigos ANSI**: Nest colorea la salida. Limpiar con `sed -E 's/\x1b\[[0-9;]*m//g'`.

### Vía alternativa: Dozzle
La instancia expone **Dozzle en el puerto 7000** (abierto a `0.0.0.0/0` en el SG), que es un
visor web de logs de Docker. Útil si SSM no responde.

---

## 4. Línea de tiempo del incidente

Todos los horarios en **ART (UTC-3)**.

| Hora | Evento | Evidencia |
|---|---|---|
| hasta 13:50 | Operación normal. CPU estable en **5-9%**, ~100 líneas de log/min | CloudWatch `CPUUtilization` |
| **14:00:20** | `POST /api/email/campanias` — campaña **`tpa_0709`**, archivo `toyop_3401_20260907.csv` | log `CampaniasEmailController` |
| 14:00:24 | Responde **201 en 3628ms**. Esta campaña **terminó bien** (hay `Archivo CSV eliminado`) | log `HTTP` |
| **14:00:44** | Se crea una segunda campaña: **`Ausa_0709`** | log `CampaniasEmailService` |
| 14:00 | El log salta a **9.587 líneas** en ese minuto | conteo sobre `docker logs` |
| 14:01 | **26.082 líneas** en un minuto (~260x el baseline) | idem |
| 14:01:48 | **Última línea de log.** `DEBUG [DeudoresService] Deudor 47201061 actualizado` | idem |
| 14:01:50 → 14:37 | **Cero líneas de log durante 36 minutos.** CPU clavada en 55-68% | `docker logs ... \| wc -l` → `0` |
| ~13:58-14:00 | El agente SSM pierde conexión (último ping **13:57:56**) | `ssm describe-instance-information` |
| 14:00 en adelante | El ALB devuelve **504** en todas las rutas. Target `unhealthy` / `Target.Timeout` | `curl`, `describe-target-health` |
| **14:37:45** | `aws ec2 reboot-instances` | acción manual |
| 14:42:18 | SSM vuelve **Online**, contenedores arriba | monitoreo |
| ~14:43 | Servicio operativo, confirmado por el usuario desde la web | — |

La campaña **`Ausa_0709` nunca completó**: no hay `201`, no hay `Archivo CSV eliminado`.
El proceso murió a mitad del import.

---

## 5. Causa raíz

### 5.1 El mecanismo del cuelgue

El límite de heap del proceso Node es **2096 MB** (default de V8; `NODE_OPTIONS` está vacío),
aunque la máquina tiene **7,6 GB** y el contenedor no tiene memory limit. Verificado en vivo:

```
$ docker exec amsa-backend-1 node -p "require('v8').getHeapStatistics().heap_size_limit/1048576"
2096
```

Al alcanzar ese techo, V8 entra en **espiral de GC**: gasta prácticamente todo el CPU
recolectando basura, las asignaciones apenas progresan y el event loop no avanza más.
No crashea con `JavaScript heap out of memory` porque el GC logra liberar lo mínimo cada
vez — el proceso simplemente **queda girando indefinidamente**.

Cada síntoma observado encaja con esto:

| Síntoma | Explicación |
|---|---|
| Silencio total en los logs (0 líneas / 36 min) | El proceso no avanza, no llega a emitir nada |
| CPU fija en 55-68% de 2 vCPU (≈1,4 cores) | Node es single-threaded: un core es el GC girando |
| ALB devuelve **504** y no 502/503 | El SO acepta el socket (backlog), pero nadie lo atiende |
| Agente SSM `ConnectionLost` | Se quedó sin CPU para responder al heartbeat |
| EC2 status checks en **ok** | Se miden a nivel hypervisor, no dependen de la app |

### 5.2 Por qué se llenó la memoria

El endpoint `POST /api/email/campanias` ([campanias-email.controller.ts:28](../../backend/src/modules/email/campanias-email/campanias-email.controller.ts#L28))
llama a `crearCampañaEmail`, que hace **todo el import de forma síncrona dentro del request
HTTP, en el proceso de la API**: [campanias-email.service.ts:85-135](../../backend/src/modules/email/campanias-email/campanias-email.service.ts#L85-L135)

Los cuatro acumuladores de memoria:

1. **`parseCsvEmail` carga el CSV entero en un array.**
   [csv-parser.ts:42](../../backend/src/modules/whatsapp/campanias/utils/csv-parser.ts#L42)
   Lee con stream pero acumula todo en `contactos[]` antes de resolver la promesa.

2. **Cada contacto guarda la fila DOS veces.** En el mismo parser:
   ```ts
   contactos.push({ email, datos: otrosCampos, rawRow: data });
   ```
   `datos` es la fila sin el email y `rawRow` es la fila completa — contenido duplicado.
   Como objetos JS, el consumo real es varias veces el tamaño del archivo en disco.

3. **`mapWithConcurrency` retiene todos los resultados.**
   [concurrency.ts:13](../../backend/src/common/concurrency.ts#L13) construye
   `results = new Array<R>(items.length)` y guarda **el objeto `Deudor` completo** que devuelve
   `upsertDesdeImport`, aunque el llamador solo usa `deudor?.id`.

4. **Un `logger.debug` por cada registro.**
   [deudores.service.ts:449](../../backend/src/modules/deudores/deudores.service.ts#L449)
   ```ts
   this.logger.debug(`Deudor ${idDeudor} actualizado (${Object.keys(updateData).length} campos)`);
   ```
   De ahí las 26.082 líneas/minuto.

Dos CSVs grandes con 24 segundos de diferencia, sobre un techo de 2 GB, alcanzaron para
cruzarlo.

### 5.3 Lo que NO fue la causa

Descartado con evidencia — importante para no perder tiempo:

- **No fue un deploy.** El último build de CodeBuild es del **2026-08-21** (commit `39c0d70`),
  17 días antes. No se tocó nada ese día.
- **No fueron los créditos de CPU.** Es una `t3.large` (burstable), pero `CPUCreditBalance`
  estaba en **864, prácticamente lleno**, y `CPUSurplusCreditBalance` en 0. No hubo throttling.
- **No fue el pool de Prisma.** Era la hipótesis inicial por los commits `922cc28` y `7344896`,
  pero **no apareció ni un error de pool** en los logs. Además el perfil no encaja: el pool
  agotado deja los requests esperando I/O, lo que se ve como CPU *baja*, no como un core al palo.
  **`mapWithConcurrency(contactos, 25, ...)` funcionó como se esperaba.**
- **No fue el disco.** 39 GB usados de 60 GB (64%) — ajustado pero no lleno.
- **No fue el OOM killer del kernel.** El proceso nunca murió; quedó vivo y girando.

---

## 6. Problema secundario: el health check nunca funcionó

**Independiente del incidente, y probablemente presente desde el día uno.**

nginx (`/etc/nginx/conf.d/10-api.conf`, dentro de `amsa-nginx-1`) define:

```nginx
# (opcional) healthcheck
location = /health {
  proxy_set_header Host $host;
  proxy_pass http://backend_upstream/health;
}
```

Pero el backend tiene `setGlobalPrefix('api')` en
[main.ts:41](../../backend/src/main.ts#L41), así que sirve todo bajo `/api/*`.
**No existe ningún endpoint `/health`.** Verificado desde adentro de la instancia:

```
/api/health  → 404
/api         → 200
```

El health check del ALB viene recibiendo **404 desde siempre**. Al momento de escribir esto,
con la app funcionando perfectamente, el target sigue figurando:

```json
{ "State": "unhealthy", "Reason": "Target.FailedHealthChecks" }
```

**La app funciona igual porque el ALB hace fail-open**: cuando *todos* los targets de un grupo
están unhealthy, enruta tráfico a todos de todas formas.

### Por qué esto importa tanto

- El ALB **no puede distinguir "sana" de "colgada"** — en ambos casos hace lo mismo.
- **Nunca puede saltar una alarma** basada en `UnHealthyHostCount`: ya está en rojo permanente.
- Si algún día se agrega una segunda instancia, el ALB mandará tráfico a targets rotos.
- Es la razón por la que el incidente se detectó **por reporte de usuarios y no por monitoreo**.

---

## 7. Plan de mitigación

Ordenado por relación impacto/esfuerzo. Los ítems 1, 4, 5 y 7 son rápidos y bajan mucho el riesgo.

### 1. Arreglar el health check — **prioridad máxima, esfuerzo chico**

Sin esto no hay detección posible de ninguna falla futura.

- Crear un `HealthController` en el backend que devuelva 200 y verifique **DB (Prisma) y Redis**.
- Excluirlo del prefijo global en [main.ts:41](../../backend/src/main.ts#L41):
  ```ts
  app.setGlobalPrefix('api', { exclude: ['health'] });
  ```
- Alternativa sin tocar Nest: cambiar el `proxy_pass` de nginx a `http://backend_upstream/api`.
  Sirve para que el check pase, pero no verifica dependencias — preferir la opción de arriba.
- **Verificar después:** el target debe pasar a `healthy` en `describe-target-health`.

> Nota: durante una espiral de GC *cualquier* endpoint deja de responder, así que un health
> check trivial ya habría detectado este incidente. Lo importante es que **funcione cuando la
> app está sana**, para que su falla signifique algo.

### 2. Mover el import de campañas a un worker BullMQ — **el arreglo de fondo, esfuerzo medio**

Es además lo que pide el propio [CLAUDE.md](../../CLAUDE.md): los procesos pesados van en workers.
Ya existe `amsa-emailworker-1`; usar el skill `bullmq-worker`.

- El endpoint debe: crear la campaña, guardar el archivo, **encolar el job** y devolver `202`
  con un id de seguimiento.
- El worker procesa el import y emite progreso por socket — **la infraestructura de progreso por
  socket ya existe** y se usa para el envío de campañas (`SocketGateway`, evento `progreso`).
- Beneficio central: un import pesado ya no puede tumbar la API. En el peor caso muere el worker,
  que tiene retry y aislamiento.
- Aplica a los tres llamadores de `upsertDesdeImport`:
  - [campanias-email.service.ts:105](../../backend/src/modules/email/campanias-email/campanias-email.service.ts#L105)
  - [wapi-campanias.service.ts:59](../../backend/src/modules/wapi/campanias/wapi-campanias.service.ts#L59)
  - [campanias.service.ts:39](../../backend/src/modules/whatsapp/campanias/campanias.service.ts#L39)

### 3. Reducir el consumo de memoria del import — **esfuerzo medio**

Incluso dentro de un worker conviene, porque el volumen sigue creciendo.

- **No duplicar la fila** en `parseCsvEmail`: hoy guarda `datos` y `rawRow` con el mismo
  contenido. Derivar uno del otro en el momento de usarlo.
- **No retener las entidades**: que `upsertDesdeImport` devuelva solo el `id`, o que el llamador
  no acumule. `mapWithConcurrency` guarda el array completo de resultados por diseño — para este
  caso conviene una variante que descarte, o mapear a `id` dentro del iteratee.
- **Procesar por lotes en streaming**: leer el CSV de a chunks (p. ej. 5.000 filas), upsertear,
  insertar contactos, liberar, y recién ahí seguir. Hoy carga todo, procesa todo, inserta todo.

### 4. Sacar el logging DEBUG por registro — **esfuerzo chico**

- Reemplazar el `logger.debug` por registro de
  [deudores.service.ts:449](../../backend/src/modules/deudores/deudores.service.ts#L449) y el
  `logger.log` de la rama CREATE (línea 470) por un **resumen al final**
  (`X creados, Y actualizados, Z sin cambios`).
- `NODE_ENV=production` está seteado pero **`LOG_LEVEL` está vacío** y el nivel debug sale igual.
  Configurar los niveles del logger de Nest para excluir `debug`/`verbose` en producción.
- Revisar también el `SocketGateway`, que loguea **payloads completos** (objetos de mensaje
  enteros, y hasta los QR de sesión de WhatsApp) en cada emisión.

### 5. Rotación de logs de Docker — **esfuerzo chico, riesgo real**

Configuración actual: `{"Type":"json-file","Config":{}}` — **sin rotación, crecimiento ilimitado**.

Estado medido el día del incidente:
```
amsa-nginx-1     2.7G     <-- el más grande
amsa-backend-1   623M
amsa-emailworker-1  109M
amsa-redis-1     37M
TOTAL            3.4G
```
Con el disco al 64%, esto termina en una caída por disco lleno.

- Agregar al compose de la instancia:
  ```yaml
  logging:
    driver: json-file
    options: { max-size: "50m", max-file: "5" }
  ```
- O globalmente en `/etc/docker/daemon.json` (aplica a contenedores nuevos; requiere recrearlos).
- Truncar los logs actuales para recuperar los 3,4 GB.

### 6. Observabilidad: log group y alarmas — **esfuerzo chico**

- **No existe log group de CloudWatch para amsa-sender.** Los únicos que hay son
  `/amsa-gestion/backend`, `/aws/codebuild/amsa-backend-build`, `/aws/connect/amsa-gestion-poc`,
  `/aws/lambda/starInstances`, `/aws/lambda/stopInstances`, `RDSOSMetrics`.
  Hoy los logs viven **solo dentro de la instancia**: si se pierde la máquina, se pierde la
  evidencia. Configurar el log driver `awslogs` o el CloudWatch agent.
- **No hay ninguna alarma.** Mínimo recomendado (todas dependen del ítem 1 para ser útiles):
  - `UnHealthyHostCount >= 1` en el target group
  - `TargetResponseTime` alto o `HTTPCode_ELB_5XX_Count > 0`
  - `CPUUtilization` sostenida por encima del baseline
  - `StatusCheckFailed` de la instancia
- Instalar el **CloudWatch agent** para tener métrica de **memoria** — hoy no existe
  (el namespace `CWAgent` está vacío para esta instancia), y era justo el dato que faltaba
  para confirmar la causa en el momento.

### 7. Subir el límite de heap de Node — **trivial, paliativo**

La máquina tiene 7,6 GB y Node se autolimita a 2 GB. Como medida puente hasta tener 2 y 3:

```yaml
environment:
  - NODE_OPTIONS=--max-old-space-size=4096
```

> No es una solución: solo corre el techo más arriba. Con un CSV suficientemente grande vuelve
> a pasar. Sirve para bajar el riesgo mientras se implementan los arreglos reales.

---

## 8. Pendientes de verificación

### 8.1 La campaña `Ausa_0709` quedó a medias
Se creó a las 14:00:44 y el proceso murió antes del `createMany` de contactos. En el código, el
registro `campañaEmail` se crea **antes** del loop de upserts
([campanias-email.service.ts:92](../../backend/src/modules/email/campanias-email/campanias-email.service.ts#L92)),
así que lo más probable es que exista la campaña **sin contactos asociados**.

**Acción:** buscarla en la tabla `campañaEmail`, verificar si tiene `contactoEmail` asociados, y
borrarla si quedó rota. Confirmar también el estado de `tpa_0709` (esa sí completó, pero conviene
chequear que el conteo de contactos cierre).

### 8.2 No hay vía de acceso de emergencia
Durante la caída no había forma de entrar: SSM caído por falta de CPU, y SSH descartado
(puerto 22 restringido a `190.16.88.238/32` + instancia sin key pair).
Si el reboot no hubiera alcanzado, no había plan B.

**Acción:** definir un mecanismo break-glass — key pair asociada, EC2 Instance Connect, o
Serial Console habilitada.

### 8.3 Secreto de base de datos versionado
[docker-composeee.yml](../../docker-composeee.yml) tiene la contraseña de MySQL en texto plano y
está commiteado. Ese archivo además está desactualizado respecto del stack real.

**Acción:** rotar esa credencial, sacarla del repo (variables de entorno o Secrets Manager) y
borrar o actualizar el compose obsoleto.

### 8.4 CPU post-reboot
Tras el reinicio la CPU bajó de 68% → 34% → 22%, pero el baseline previo era **5-9%**.
Puede ser trabajo encolado poniéndose al día. **Vale la pena confirmar que volvió al baseline.**

```bash
AWS_PROFILE=amsa aws cloudwatch get-metric-statistics \
  --namespace AWS/EC2 --metric-name CPUUtilization \
  --dimensions Name=InstanceId,Value=i-031266d1bcb22feec \
  --start-time "$(date -u -d '2 hours ago' +%Y-%m-%dT%H:%M:%S)" \
  --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
  --period 300 --statistics Average \
  --query 'sort_by(Datapoints,&Timestamp)[].{T:Timestamp,Avg:Average}' --output text
```

---

## 9. Comandos de diagnóstico útiles

```bash
export AWS_PROFILE=amsa PATH="$HOME/.local/bin:$PATH"

# ¿Está sana la API desde afuera?
curl -s -o /dev/null -w "%{http_code}\n" https://api.amsasender.anamayasa.com/api   # 200 = ok

# Salud del target en el ALB
aws elbv2 describe-target-health \
  --target-group-arn arn:aws:elasticloadbalancing:us-east-1:592943773890:targetgroup/amsa-backend-gd/bd6f81a46dfe4d55

# ¿Responde el agente SSM? (ConnectionLost = la instancia está en problemas)
aws ssm describe-instance-information \
  --filters "Key=InstanceIds,Values=i-031266d1bcb22feec" \
  --query 'InstanceInformationList[].{Ping:PingStatus,LastPing:LastPingDateTime}'

# Estado de los contenedores y recursos
aws ssm send-command --instance-ids i-031266d1bcb22feec \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["docker ps","free -m","df -h /","docker stats --no-stream"]'

# Volumen de log por minuto — detecta explosiones de logging
# (recordar: --since/--until en UTC, los logs de Nest imprimen en ART)
docker logs amsa-backend-1 --since 2026-09-07T16:40:00 --until 2026-09-07T17:10:00 2>&1 \
  | sed -E 's/\x1b\[[0-9;]*m//g' \
  | grep -oE '[0-9]{1,2}:[0-9]{2}:[0-9]{2} [AP]M' | cut -d: -f1,2 | sort | uniq -c

# Último deploy (para descartar que la causa sea un release)
aws codebuild batch-get-builds --ids <build-id> \
  --query 'builds[].{Status:buildStatus,End:endTime,Commit:resolvedSourceVersion}'
```

---

## 10. Estado al cierre de la sesión (2026-09-07 ~15:00 ART)

| Item | Estado |
|---|---|
| Servicio | ✅ Operativo, confirmado por el usuario desde la web |
| Contenedores | ✅ Los 8 arriba |
| Memoria backend | ✅ 363 MB / 7,6 GB |
| Disco | ⚠️ 64% (39 GB / 60 GB), sin rotación de logs |
| Target group | ❌ `unhealthy` — health check roto (ítem 1 del plan) |
| Causa raíz | ✅ Identificada |
| Mitigaciones | ❌ **Ninguna aplicada** |

**Próximo paso sugerido:** arrancar por el ítem 1 (health check), que es chico y desbloquea toda
la detección. Después el ítem 2 (import a worker), que es el arreglo de fondo.
