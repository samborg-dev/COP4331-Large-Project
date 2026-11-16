# Deploying

One DigitalOcean droplet (Ubuntu LTS) serves everything on one HTTPS origin:

```
https://cop4331-countryguesser.com/         -> nginx serves apps/web/dist (React build)
https://cop4331-countryguesser.com/api/...  -> nginx proxies to the API on 127.0.0.1:5000 (pm2)
```

Because the web app and the API share an origin, the browser never makes a
cross-origin call. The config lives in the repo:
[deploy/nginx/country-guesser.conf](../deploy/nginx/country-guesser.conf) and
[ecosystem.config.cjs](../ecosystem.config.cjs).

Anyone with SSH access can deploy, using the [Deploy](#deploy) section. Ask Sam
in Discord to have your SSH key added.

---

## Deploy

```bash
ssh deploy@cop4331-countryguesser.com
cd ~/app
git pull
pnpm install --frozen-lockfile
pnpm build
pm2 restart api
```

Then check it: `curl https://cop4331-countryguesser.com/health` should print `{"status":"ok"}`.
Also open the site in a browser.

A web-only change needs only `pnpm build`, because nginx serves the new files
straight away. Restarting the API is harmless, though.

## Roll back

```bash
cd ~/app
git log --oneline -10          # find the last good commit
git checkout <sha>
pnpm install --frozen-lockfile && pnpm build && pm2 restart api
```

When the fix is merged, go back with `git checkout main && git pull`, then
rebuild and restart.

## Logs and status

```bash
pm2 status
pm2 logs api --lines 100       # API output and errors (emails print here if RESEND_API_KEY is missing)
sudo tail -f /var/log/nginx/error.log
```

---

## First-time setup (Sam, once)

### 1. DNS (at the registrar)

| Type | Name | Value |
|---|---|---|
| A | `@` | droplet IP |
| A | `www` | droplet IP |
| MX, TXT | `send` | copied from Resend → Domains (SPF / return path) |
| TXT | `resend._domainkey` | copied from Resend → Domains (DKIM) |
| TXT | `_dmarc` | `v=DMARC1; p=none;` |

Check the A record with `nslookup cop4331-countryguesser.com`. Resend shows the domain as
**Verified** once its records have propagated.

### 2. Server packages

```bash
# as root: a non-root user for the app
adduser deploy && usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy

# as deploy
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs nginx certbot python3-certbot-nginx git
sudo npm install -g pnpm@10 pm2
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw enable
```

### 3. App

```bash
cd ~ && git clone https://github.com/samborg-dev/COP4331-Large-Project.git app
cd app
cp .env.example .env && nano .env     # fill in the values below
pnpm install --frozen-lockfile
pnpm build
chmod 755 /home/deploy                # so nginx (www-data) can read apps/web/dist
```

Production `.env`. The real values go in this file only. Never commit them.

```
NODE_ENV=production
PORT=5000
MONGODB_URI=<from Noah, by DM>
ACCESS_TOKEN_SECRET=<node -e "console.log(require('crypto').randomBytes(48).toString('hex'))">
RESEND_API_KEY=<from the Resend dashboard>
MAIL_FROM=Country Guesser <noreply@cop4331-countryguesser.com>
APP_URL=https://cop4331-countryguesser.com
VITE_API_URL=https://cop4331-countryguesser.com
```

`VITE_API_URL` is baked into the web build. After you change it, rerun
`pnpm build`.

### 4. nginx and HTTPS

```bash
sudo cp deploy/nginx/country-guesser.conf /etc/nginx/sites-available/country-guesser
sudo sed -i 's/cop4331-countryguesser.com/<real domain>/g' /etc/nginx/sites-available/country-guesser
sudo ln -s /etc/nginx/sites-available/country-guesser /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

sudo certbot --nginx -d <real domain> -d www.<real domain> --redirect
sudo certbot renew --dry-run           # confirms auto-renewal works
```

### 5. pm2

```bash
cd ~/app
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup                            # run the command it prints, so the API comes back after a reboot
```

### 6. Check it

- `curl -I http://<domain>` returns a 301 redirect to https.
- `curl https://<domain>/health` returns `{"status":"ok"}`.
- Opening `https://<domain>/verify-email?token=x` loads the app, not an nginx 404.
- `pnpm --filter @cop4331/api mail:test <your gmail>`, and then the same with a UCF
  address, both arrive in the inbox. In Gmail, check **Show original**: SPF, DKIM
  and DMARC should all say PASS.
- Send Noah the droplet IP for the Atlas allowlist.
