# Despliegue en Clouding (1 GB RAM · ½ vCore · 5 GB NVMe · 3 €/mes)

> **Estado: DIFERIDO.** El desarrollo es local (ADR-004). Este documento queda como plan para cuando se decida publicar el mundo; revisarlo entonces (versiones de Node, Caddy, etc.).

## Principios

- **No se compila en el servidor.** Se construye en local o en GitHub Actions y se suben los artefactos.
- **Un worker, una API, un proxy.** Sin Docker, sin base de datos en servidor aparte, sin Redis.
- **Los backups salen del servidor.** El disco es pequeño y la triple réplica no protege de un borrado accidental.

## Presupuesto de recursos

| Componente | RAM estimada | Disco |
|---|---|---|
| Ubuntu 24.04 mínimo + systemd + sshd | 120–160 MB | 2,0 GB |
| Caddy | 20–40 MB | 50 MB |
| Worker (Node + mundo de 200–500 personas) | 80–150 MB | — |
| API (Node + Fastify) | 50–80 MB | — |
| Artefactos de la app + node_modules de producción | — | 150–250 MB |
| SQLite (estado + eventos + instantáneas) | caché de página | objetivo < 1,5 GB |
| Swap | — | 1 GB |
| Margen / logs | 400+ MB libres | resto |

Si el uso de memoria del worker supera 300 MB o el disco supera el 75 %, se activa la política de retención (spec 027) y se revisa el plan.

## 1. Preparar el servidor (una vez)

Elegir **Ubuntu 24.04 LTS** en Clouding y añadir tu clave SSH pública al crear el servidor.

```bash
# Como root
adduser mundo && usermod -aG sudo mundo
rsync --archive --chown=mundo:mundo ~/.ssh /home/mundo
# /etc/ssh/sshd_config: PermitRootLogin no, PasswordAuthentication no
systemctl restart ssh

apt update && apt upgrade -y
apt install -y ufw unattended-upgrades sqlite3 rclone
ufw allow OpenSSH && ufw allow 80 && ufw allow 443 && ufw enable

# Swap de 1 GB
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
sysctl vm.swappiness=10 && echo 'vm.swappiness=10' >> /etc/sysctl.conf

# Limitar logs
sed -i 's/#SystemMaxUse=/SystemMaxUse=200M/' /etc/systemd/journald.conf && systemctl restart systemd-journald
```

### Node.js 24 LTS y Caddy

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash - && apt install -y nodejs
corepack enable
apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
apt update && apt install -y caddy
```

### Directorios

```
/srv/mundo/app/        código desplegado (releases/<fecha> + symlink current)
/srv/mundo/data/       mundo.sqlite, instantáneas
/srv/mundo/backups/    temporales antes de subir
/etc/mundo/env         variables de entorno (permisos 600)
```

## 2. Servicios systemd

`/etc/systemd/system/mundo-worker.service`

```ini
[Unit]
Description=Mundo Social - worker de simulación
After=network.target

[Service]
User=mundo
WorkingDirectory=/srv/mundo/app/current
EnvironmentFile=/etc/mundo/env
ExecStart=/usr/bin/node --max-old-space-size=256 apps/worker/dist/main.js
Restart=always
RestartSec=5
Nice=5
MemoryMax=400M

[Install]
WantedBy=multi-user.target
```

`/etc/systemd/system/mundo-api.service`

```ini
[Unit]
Description=Mundo Social - API
After=network.target mundo-worker.service

[Service]
User=mundo
WorkingDirectory=/srv/mundo/app/current
EnvironmentFile=/etc/mundo/env
ExecStart=/usr/bin/node --max-old-space-size=128 apps/api/dist/main.js
Restart=always
RestartSec=5
MemoryMax=200M

[Install]
WantedBy=multi-user.target
```

El worker hace **apagado limpio** al recibir SIGTERM: vuelca el buffer de eventos, escribe instantánea y cierra la base.

`/etc/mundo/env`

```
NODE_ENV=production
DB_PATH=/srv/mundo/data/mundo.sqlite
API_PORT=3000
WORLD_SEED=482917
TICK_MINUTES=5
DEFAULT_SPEED=10
```

## 3. Caddy (HTTPS automático)

`/etc/caddy/Caddyfile`

```
mundo.tudominio.com {
    encode zstd gzip
    handle /api/* {
        reverse_proxy 127.0.0.1:3000 {
            flush_interval -1   # necesario para SSE
        }
    }
    handle {
        root * /srv/mundo/app/current/apps/web/dist
        try_files {path} /index.html
        file_server
    }
    # Durante desarrollo: proteger todo
    basic_auth {
        investigador <hash generado con: caddy hash-password>
    }
}
```

Apuntar un registro DNS A del dominio a la IP del servidor.

## 4. Despliegue

Desde GitHub Actions (o a mano desde tu equipo):

```bash
pnpm install --frozen-lockfile && pnpm build
pnpm deploy --filter=@mundo/worker --prod out/worker   # o empaquetado equivalente
REL=$(date +%Y%m%d-%H%M%S)
rsync -az --delete out/ mundo@SERVIDOR:/srv/mundo/app/releases/$REL/
ssh mundo@SERVIDOR "ln -sfn /srv/mundo/app/releases/$REL /srv/mundo/app/current \
  && sudo systemctl restart mundo-worker mundo-api \
  && ls -1dt /srv/mundo/app/releases/* | tail -n +4 | xargs rm -rf"
```

Se conservan las 3 últimas versiones para volver atrás cambiando el symlink. `better-sqlite3` tiene binarios precompilados para Linux x64; construir en `ubuntu-24.04` en CI para que coincidan.

Las migraciones de base de datos las ejecuta el worker al arrancar (spec 027), con copia previa automática.

## 5. Backups

Cron diario (`crontab -e` del usuario mundo):

```
15 4 * * * sqlite3 /srv/mundo/data/mundo.sqlite ".backup '/srv/mundo/backups/mundo.sqlite'" && zstd -f -q /srv/mundo/backups/mundo.sqlite && rclone copy /srv/mundo/backups/mundo.sqlite.zst remoto:mundo/$(date +\%F)/ && rm /srv/mundo/backups/mundo.sqlite*
```

`remoto` puede ser Google Drive, Backblaze B2 o cualquier destino de rclone. Probar la restauración al menos una vez por hito.

## 6. Operación

- Estado: `systemctl status mundo-worker mundo-api`, `journalctl -u mundo-worker -f`.
- Salud: `GET /api/health` devuelve minuto del mundo, ticks/s, RSS y tamaño de la base.
- Memoria: `free -m`; si el worker se acerca a `MemoryMax`, reducir población activa en nivel alto o aumentar la compactación.
- Actualizaciones de seguridad automáticas con `unattended-upgrades`.

## 7. Cuándo cambiar de plan

- Worker usando > 50 % de CPU de forma sostenida a la velocidad deseada.
- Base de datos > 2,5 GB tras compactación.
- Necesidad de LLM con alto volumen o de varios mundos simultáneos.

El siguiente escalón razonable en Clouding es 2 GB / 1 vCore / 10–20 GB. La arquitectura no cambia.
