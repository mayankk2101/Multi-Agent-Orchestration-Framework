# Cloudflare Setup Checklist — Hotel CRM

**Domain:** hotelcrm.app  
**Cloudflare plan:** Free  
**SSL mode:** Full (Strict)

---

## 1. Add Domain to Cloudflare

- [ ] Log in to Cloudflare → Add a Site → enter `hotelcrm.app`
- [ ] Select Free plan
- [ ] Copy the two Cloudflare nameservers provided
- [ ] Update nameservers at your domain registrar (replace existing NS records)
- [ ] Wait for nameserver propagation (up to 24h; usually < 1h)
- [ ] Confirm: Cloudflare dashboard shows "Active" status for the domain

---

## 2. DNS Records

Add the following A records after the Droplet IP is known.

| Type | Name | Value | Proxy | TTL |
|------|------|-------|-------|-----|
| A | `api` | `<PROD_DROPLET_IP>` | Proxied (orange cloud ON) | Auto (60s) |
| A | `hotelcrm.app` | `<PROD_DROPLET_IP>` | Proxied (orange cloud ON) | Auto (60s) |
| A | `www` | `<PROD_DROPLET_IP>` | Proxied (orange cloud ON) | Auto (60s) |
| A | `status` | UptimeRobot status page IP | DNS only (grey cloud) | Auto |
| A | `staging-api` | `<STAGING_DROPLET_IP>` | Proxied (orange cloud ON) | Auto |

> **Important:** Set TTL to 60s on all proxied A records for fast DR failover.

- [ ] All production A records created with proxy ON
- [ ] Staging A record created
- [ ] DNS propagated: `dig api.hotelcrm.app` returns Cloudflare IPs (not Droplet IP)

---

## 3. SSL/TLS Configuration

- [ ] Go to **SSL/TLS** → **Overview** → set mode to **Full (Strict)**
- [ ] Go to **SSL/TLS** → **Edge Certificates** → enable **Always Use HTTPS**
- [ ] Go to **SSL/TLS** → **Edge Certificates** → enable **HTTP Strict Transport Security (HSTS)**
  - Max-Age: 6 months
  - Include subdomains: ON
  - Preload: OFF (enable only after confirming everything works)

### Generate Origin Certificate

- [ ] Go to **SSL/TLS** → **Origin Server** → **Create Certificate**
  - Key type: RSA (2048)
  - Hostnames: `hotelcrm.app`, `*.hotelcrm.app`
  - Certificate validity: 15 years
- [ ] Save the **Origin Certificate** (PEM) → paste into Droplet at `/etc/ssl/cloudflare/cert.pem`
- [ ] Save the **Private Key** (PEM) → paste into Droplet at `/etc/ssl/cloudflare/key.pem`
- [ ] Set permissions on Droplet:
  ```bash
  sudo mkdir -p /etc/ssl/cloudflare
  sudo chmod 700 /etc/ssl/cloudflare
  sudo chmod 644 /etc/ssl/cloudflare/cert.pem
  sudo chmod 600 /etc/ssl/cloudflare/key.pem
  ```
- [ ] Nginx SSL directives point to these files (see `nginx/hotelcrm.conf`)
- [ ] Confirm: `curl -I https://api.hotelcrm.app/api/v1/health` returns 200

---

## 4. WAF — Managed Rules

- [ ] Go to **Security** → **WAF** → **Managed Rules**
- [ ] Enable **Cloudflare Managed Ruleset** (OWASP Core Rule Set — included on free plan)
- [ ] Set action to **Block** (not just log) for managed ruleset
- [ ] Go to **Security** → **Bots** → enable **Bot Fight Mode** (free)

---

## 5. Rate Limiting (Free Tier)

Cloudflare free tier includes basic rate limiting via Firewall Rules.

- [ ] Go to **Security** → **WAF** → **Rate limiting rules** → Create rule:
  - Name: `Auth rate limit`
  - If: URI path contains `/api/v1/auth`
  - Rate: more than 10 requests per 1 minute per IP
  - Action: Block for 1 minute

---

## 6. Firewall Rules

- [ ] Go to **Security** → **WAF** → **Firewall rules** → Create rule:
  - Name: `Block non-Cloudflare to origin` (enforced at DO firewall level — see deployment scripts)

- [ ] Block known bad bots:
  - Expression: `(cf.client.bot)` → Action: Block

---

## 7. Page Rules / Cache

- [ ] Go to **Caching** → **Configuration** → set **Browser Cache TTL** to **4 hours**
- [ ] Create Cache Rule:
  - Match: `hotelcrm.app/api/*` → Cache: Bypass (API responses must not be cached at edge)
  - Match: `hotelcrm.app/_next/static/*` → Cache: Cache Everything, Edge TTL: 1 month

---

## 8. Analytics & Monitoring

- [ ] Go to **Analytics & Logs** → confirm traffic is visible (means proxying is active)
- [ ] Go to **Security** → **Events** → bookmark for weekly threat review
- [ ] Go to **Speed** → **Observatory** → run a performance test after first deployment

---

## 9. Failover DNS (DR Preparation)

When a region failover to ams3 is needed:

```
1. Provision replacement Droplet in ams3
2. In Cloudflare DNS, update A records:
   api.hotelcrm.app → <AMS3_DROPLET_IP>
   hotelcrm.app     → <AMS3_DROPLET_IP>
3. TTL is 60s — propagation completes within 2 minutes globally
4. Cloudflare proxy continues absorbing traffic during propagation
```

- [ ] AMS3 Droplet IP is documented in the DR runbook before it is needed
- [ ] A records have TTL set to 60s (Auto in Cloudflare = ~300s; manually set to 60s)

---

## 10. Post-Launch Verification

- [ ] `https://api.hotelcrm.app/api/v1/health` → 200 OK
- [ ] `https://hotelcrm.app` → loads frontend
- [ ] `https://www.hotelcrm.app` → redirects to `https://hotelcrm.app`
- [ ] `http://api.hotelcrm.app` → redirects to `https://`
- [ ] SSL Labs test: `https://www.ssllabs.com/ssltest/` → grade A or A+
- [ ] Security headers check: `https://securityheaders.com/` → grade A
- [ ] Cloudflare dashboard shows traffic flowing (not grey-clouded bypass)
