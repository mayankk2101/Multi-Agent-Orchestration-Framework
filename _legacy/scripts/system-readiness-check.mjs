#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const reportsDir = path.join(rootDir, 'reports');
const logsDir = path.join(rootDir, 'logs', 'readiness');

const args = new Set(process.argv.slice(2));
const shouldStart = !args.has('--no-start');
const keepRunning = args.has('--keep-running');
const verbose = args.has('--verbose');

const services = [
  { name: 'auth-service', port: 3001, healthPath: '/health', gatewayPath: '/api/v1/auth/signup', method: 'POST', body: { email: 'readiness@example.com' } },
  { name: 'crm-service', port: 3020, healthPath: '/health', gatewayPath: '/api/v1/crm/hotels' },
  { name: 'hr-service', port: 3003, healthPath: '/health', gatewayPath: '/api/v1/hr/contracts' },
  { name: 'quality-service', port: 3004, healthPath: '/health', gatewayPath: '/api/v1/quality/ratings', method: 'POST', body: { score: 5 } },
  { name: 'calendar-service', port: 3005, healthPath: '/health', gatewayPath: '/api/v1/calendar/schedules' },
  { name: 'staffing-service', port: 3006, healthPath: '/health', gatewayPath: '/api/v1/staffing/work-requests', method: 'POST', body: { role: 'checker' } },
  { name: 'notifications-service', port: 3007, healthPath: '/health', gatewayPath: '/api/v1/notifications/notifications', method: 'POST', body: { message: 'readiness' } },
  { name: 'geo-service', port: 3008, healthPath: '/health', gatewayPath: '/api/v1/geo/locations', method: 'POST', body: { lat: 0, lng: 0 } },
  { name: 'chatbot-service', port: 3009, healthPath: '/health', gatewayPath: '/api/v1/chatbot/chat', method: 'POST', body: { message: 'hello' } },
  { name: 'analytics-service', port: 3010, healthPath: '/health', gatewayPath: '/api/v1/analytics' },
  { name: 'api-gateway', port: 3000, healthPath: '/health', isGateway: true },
];

const frontend = { name: 'frontend', dir: 'frontend', port: 3002, healthPath: '/' };
const startedProcesses = [];
const results = [];

function addResult(area, name, status, details = '', priority = '') {
  results.push({ area, name, status, details, priority });
  const symbol = status === 'PASS' ? '✓' : status === 'WARN' ? '!' : status === 'SKIP' ? '-' : '✗';
  console.log(`${symbol} [${status}] ${area}: ${name}${details ? ` - ${details}` : ''}`);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const index = trimmed.indexOf('=');
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    value = value.replace(/^['"]|['"]$/g, '');
    env[key] = value;
  }
  return env;
}

const rootEnv = loadEnvFile(path.join(rootDir, '.env.local'));
const frontendEnv = loadEnvFile(path.join(rootDir, 'frontend', '.env.local'));
const env = { ...process.env, ...rootEnv };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function request(url, options = {}) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch (error) {
      resolve({ ok: false, error: `invalid URL: ${url}` });
      return;
    }
    const client = parsed.protocol === 'https:' ? https : http;
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const req = client.request({
      method: options.method || 'GET',
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      timeout: options.timeout || 5000,
      headers: {
        ...(body ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body) } : {}),
        ...(options.headers || {}),
      },
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, statusCode: res.statusCode, body: data }));
    });
    req.on('timeout', () => {
      req.destroy(new Error('request timed out'));
    });
    req.on('error', (error) => resolve({ ok: false, error: error.message }));
    if (body) req.write(body);
    req.end();
  });
}

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port, timeout: 1000 });
    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.on('error', () => resolve(false));
  });
}

function commandExists(command) {
  return spawnSync('which', [command], { encoding: 'utf8' }).status === 0;
}

function runCommand(command, commandArgs, options = {}) {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...options.env },
    encoding: 'utf8',
    timeout: options.timeout || 15000,
  });
  return {
    status: result.status,
    stdout: (result.stdout || '').trim(),
    stderr: (result.stderr || '').trim(),
    error: result.error?.message,
  };
}

async function waitForHealth(service, timeoutMs = 15000) {
  const startedAt = Date.now();
  const url = `http://127.0.0.1:${service.port}${service.healthPath}`;
  while (Date.now() - startedAt < timeoutMs) {
    const response = await request(url, { timeout: 1500 });
    if (response.ok) return response;
    await sleep(500);
  }
  return request(url, { timeout: 1500 });
}

function startNodeService(service) {
  const serviceDir = path.join(rootDir, 'backend', 'services', service.name);
  const logPath = path.join(logsDir, `${service.name}.log`);
  const out = fs.openSync(logPath, 'a');
  const child = spawn('npm', ['run', 'dev'], {
    cwd: serviceDir,
    env: { ...env, PORT: String(service.port) },
    stdio: ['ignore', out, out],
    detached: false,
  });
  startedProcesses.push({ name: service.name, child, logPath });
  return child;
}

async function testServiceStartupAndHealth() {
  for (const service of services) {
    const serviceDir = path.join(rootDir, 'backend', 'services', service.name);
    const packagePath = path.join(serviceDir, 'package.json');
    if (!fs.existsSync(packagePath)) {
      addResult('Service config', service.name, 'FAIL', 'missing package.json', 'P0');
      continue;
    }
    if (!fs.existsSync(path.join(serviceDir, 'node_modules'))) {
      addResult('Service config', service.name, 'WARN', 'node_modules missing; run npm install in this service', 'P1');
    }

    const portBusy = await isPortOpen(service.port);
    if (!portBusy && shouldStart) {
      startNodeService(service);
      addResult('Service startup', service.name, 'PASS', `started on port ${service.port}`);
    } else if (portBusy) {
      addResult('Service startup', service.name, 'PASS', `port ${service.port} already open`);
    } else {
      addResult('Service startup', service.name, 'SKIP', 'not running and --no-start was used');
      continue;
    }

    const health = await waitForHealth(service);
    if (health.ok) {
      addResult('Health endpoint', service.name, 'PASS', `HTTP ${health.statusCode}`);
    } else {
      addResult('Health endpoint', service.name, 'FAIL', health.error || `HTTP ${health.statusCode}`, 'P0');
    }
  }
}

async function testGatewayRoutes() {
  const gatewayHealth = await request('http://127.0.0.1:3000/health');
  if (!gatewayHealth.ok) {
    addResult('API Gateway routing', 'gateway unavailable', 'FAIL', gatewayHealth.error || `HTTP ${gatewayHealth.statusCode}`, 'P0');
    return;
  }

  for (const service of services.filter((item) => !item.isGateway)) {
    const response = await request(`http://127.0.0.1:3000${service.gatewayPath}`, {
      method: service.method || 'GET',
      body: service.body,
      timeout: 5000,
    });
    if (response.ok) {
      addResult('API Gateway routing', service.name, 'PASS', `${service.method || 'GET'} ${service.gatewayPath} -> HTTP ${response.statusCode}`);
    } else {
      addResult('API Gateway routing', service.name, 'FAIL', `${service.method || 'GET'} ${service.gatewayPath} -> ${response.error || `HTTP ${response.statusCode}`}`, 'P0');
    }
  }
}

async function testFrontend() {
  const packagePath = path.join(rootDir, frontend.dir, 'package.json');
  if (!fs.existsSync(packagePath)) {
    addResult('Frontend', 'project', 'FAIL', 'frontend/package.json missing', 'P0');
    return;
  }

  const configuredApi = frontendEnv.NEXT_PUBLIC_API_URL || rootEnv.API_BASE_URL;
  if (!configuredApi) {
    addResult('Frontend', 'API configuration', 'FAIL', 'NEXT_PUBLIC_API_URL/API_BASE_URL missing', 'P1');
  } else {
    const response = await request(`${configuredApi.replace(/\/$/, '')}/health`);
    addResult('Frontend', 'API configuration', response.ok ? 'PASS' : 'FAIL', `${configuredApi}/health -> ${response.error || `HTTP ${response.statusCode}`}`, response.ok ? '' : 'P1');
  }

  const pageSource = fs.readFileSync(path.join(rootDir, frontend.dir, 'app', 'page.tsx'), 'utf8');
  if (/fetch\(|axios|swr|NEXT_PUBLIC_API_URL|API_BASE_URL/.test(pageSource)) {
    addResult('Frontend', 'backend call implementation', 'PASS', 'frontend source references API calls');
  } else {
    addResult('Frontend', 'backend call implementation', 'WARN', 'app/page.tsx does not make backend API calls yet', 'P2');
  }

  const frontendUrl = `http://127.0.0.1:${frontend.port}${frontend.healthPath}`;
  const response = await request(frontendUrl);
  if (response.ok) {
    addResult('Frontend', 'runtime', 'PASS', `${frontendUrl} -> HTTP ${response.statusCode}`);
  } else {
    addResult('Frontend', 'runtime', 'WARN', `${frontendUrl} -> ${response.error || `HTTP ${response.statusCode}`}`, 'P2');
  }
}

async function testDatabase() {
  const databaseUrl = rootEnv.DATABASE_URL;
  if (databaseUrl && commandExists('psql')) {
    const result = runCommand('psql', [databaseUrl, '-Atqc', 'select 1'], { timeout: 15000 });
    addResult('Database', 'PostgreSQL select 1', result.status === 0 && result.stdout === '1' ? 'PASS' : 'FAIL', result.status === 0 ? 'connected' : result.stderr || result.error, result.status === 0 ? '' : 'P0');
    return;
  }

  const supabaseUrl = rootEnv.NEXT_PUBLIC_SUPABASE_URL || frontendEnv.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = rootEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY || frontendEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    addResult('Database', 'Supabase REST connectivity', 'FAIL', 'Supabase URL or anon key missing', 'P0');
    return;
  }
  if (!/^https?:\/\//.test(supabaseUrl)) {
    addResult('Database', 'Supabase REST connectivity', 'FAIL', 'Supabase URL is not a valid http(s) URL', 'P0');
    return;
  }

  const response = await request(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/`, {
    headers: { apikey: supabaseAnonKey, authorization: `Bearer ${supabaseAnonKey}` },
    timeout: 15000,
  });
  addResult('Database', 'Supabase REST connectivity', response.ok ? 'PASS' : 'FAIL', response.error || `HTTP ${response.statusCode}`, response.ok ? '' : 'P0');
}

async function testRedis() {
  const redisUrl = rootEnv.REDIS_URL || 'redis://:dev_password@127.0.0.1:6379';
  if (commandExists('redis-cli')) {
    const parsed = new URL(redisUrl);
    const argsForRedis = ['-h', parsed.hostname || '127.0.0.1', '-p', parsed.port || '6379'];
    if (parsed.password) argsForRedis.push('-a', decodeURIComponent(parsed.password));
    argsForRedis.push('ping');
    let result = runCommand('redis-cli', argsForRedis, { timeout: 5000 });
    if (/NOAUTH|Authentication required/i.test(`${result.stdout}\n${result.stderr}`)) {
      result = runCommand('redis-cli', ['-h', parsed.hostname || '127.0.0.1', '-p', parsed.port || '6379', '-a', 'dev_password', 'ping'], { timeout: 5000 });
    }
    addResult('Redis', 'PING', result.status === 0 && /PONG/.test(result.stdout) ? 'PASS' : 'FAIL', result.stdout || result.stderr || result.error, result.status === 0 ? '' : 'P1');
    return;
  }

  const open = await isPortOpen(6379);
  addResult('Redis', 'port check', open ? 'WARN' : 'FAIL', open ? 'port 6379 is open, but redis-cli is unavailable for auth ping' : 'port 6379 is closed', open ? 'P2' : 'P1');
}

function testDocker() {
  if (!commandExists('docker')) {
    addResult('Docker', 'CLI', 'FAIL', 'docker command not found', 'P1');
    return;
  }
  const result = runCommand('docker', ['compose', 'ps'], { timeout: 10000 });
  if (result.status === 0) {
    const expected = ['redis', 'adminer', 'mailhog'];
    for (const name of expected) {
      const found = result.stdout.includes(name);
      addResult('Docker', name, found ? 'PASS' : 'WARN', found ? 'listed by docker compose ps' : 'not listed by docker compose ps', found ? '' : 'P1');
    }
  } else {
    addResult('Docker', 'compose ps', 'FAIL', result.stderr || result.error || 'docker compose ps failed', 'P1');
  }
}

function testStaticConfig() {
  const compose = fs.existsSync(path.join(rootDir, 'docker-compose.yml')) ? fs.readFileSync(path.join(rootDir, 'docker-compose.yml'), 'utf8') : '';
  for (const service of services) {
    if (service.isGateway) continue;
    if (compose.includes(service.name)) {
      addResult('Static config', `${service.name} compose entry`, 'PASS', 'present in docker-compose.yml');
    } else {
      addResult('Static config', `${service.name} compose entry`, 'WARN', 'missing from docker-compose.yml', 'P2');
    }
  }

  const startScriptPath = path.join(rootDir, 'start-all-services.sh');
  if (fs.existsSync(startScriptPath)) {
    const script = fs.readFileSync(startScriptPath, 'utf8');
    if (script.includes('web-dashboard')) {
      addResult('Static config', 'start-all-services.sh frontend path', 'FAIL', 'points to web-dashboard, but repo uses frontend', 'P1');
    }
    if (script.includes('crm-service:3002') && frontend.port === 3002) {
      addResult('Static config', 'port allocation', 'FAIL', 'crm-service and frontend both use port 3002 in current notes/config', 'P0');
    }
  }
}

function writeReport() {
  fs.mkdirSync(reportsDir, { recursive: true });
  const generatedAt = new Date().toISOString();
  const byStatus = (status) => results.filter((item) => item.status === status);
  const hasPass = (area, name) => results.some((item) => item.area === area && item.name === name && item.status === 'PASS');
  const reportPath = path.join(reportsDir, 'system-readiness-report.md');
  const lines = [
    '# System Readiness Report',
    '',
    `Generated: ${generatedAt}`,
    '',
    '## Summary',
    '',
    `- Passing checks: ${byStatus('PASS').length}`,
    `- Warnings: ${byStatus('WARN').length}`,
    `- Failures: ${byStatus('FAIL').length}`,
    `- Skipped: ${byStatus('SKIP').length}`,
    '',
    '## What Is Working Well',
    '',
    ...(hasPass('Docker', 'redis') && hasPass('Docker', 'adminer') && hasPass('Docker', 'mailhog') ? ['- Docker Compose infrastructure services are visible: Redis, Adminer, and Mailhog.'] : []),
    ...(hasPass('Redis', 'PING') ? ['- Redis accepts authenticated connections and responds to `PING`.'] : []),
    ...(hasPass('Health endpoint', 'auth-service') && hasPass('Health endpoint', 'api-gateway') ? ['- Auth Service and API Gateway health endpoints are responding.'] : []),
    ...(results.filter((item) => item.area === 'Health endpoint' && item.status === 'PASS').length >= 8 ? ['- Most Node services can be started by the readiness harness and respond on `/health`.'] : []),
    ...(hasPass('Frontend', 'runtime') ? ['- The frontend runtime is reachable on its configured local port.'] : []),
    '',
    '## What Needs Fixing',
    '',
    '- Keep the local port map consistent across services, scripts, Docker, and the readiness harness.',
    '- Fix API Gateway proxy path handling. Mounted Express middleware receives paths after the mount prefix is stripped, so the current `pathRewrite` rules send requests like `/contracts` instead of `/api/v1/contracts`.',
    '- Fix POST proxying through the API Gateway. `express.json()` runs before proxy middleware, so proxied POST bodies can be consumed before `http-proxy-middleware` forwards them.',
    '- Replace placeholder or malformed Supabase values in `.env.local`; the current Supabase URL is not a valid `http(s)` URL.',
    '- Update `start-all-services.sh`; it points to `web-dashboard`, but this repo uses `frontend`.',
    '',
    '## Missing Or Incomplete',
    '',
    '- Backend Node services are not represented in `docker-compose.yml`; only Redis, Adminer, and Mailhog are defined.',
    '- The frontend still appears to be the stock Next.js starter page and does not make an application API call from `app/page.tsx`.',
    '- Service endpoints are placeholders (`coming soon`) and do not yet exercise Supabase-backed business flows.',
    '- There is no shared smoke-test command for mobile apps yet.',
    '',
    '## Recommended Next Steps',
    '',
    '1. Keep the selected port map consistent: API Gateway `3000`, Auth `3001`, frontend `3002`, HR `3003`, and CRM `3020`.',
    '2. Fix API Gateway routing, then rerun `npm run test:readiness -- --no-start` against already-running services.',
    '3. Correct `.env.local` and verify Supabase with this readiness check before wiring feature work to database tables.',
    '4. Add backend service definitions or a separate dev compose profile so the full stack can be started reproducibly.',
    '5. Replace the frontend starter screen with a minimal authenticated CRM shell that calls the API Gateway health/status endpoint first.',
    '',
    '## Priority Fixes',
    '',
    ...results
      .filter((item) => item.priority)
      .sort((a, b) => a.priority.localeCompare(b.priority))
      .map((item) => `- ${item.priority}: ${item.area} / ${item.name}: ${item.details}`),
    '',
    '## Detailed Results',
    '',
    '| Status | Area | Check | Details | Priority |',
    '| --- | --- | --- | --- | --- |',
    ...results.map((item) => `| ${item.status} | ${item.area} | ${item.name} | ${String(item.details).replace(/\|/g, '\\|')} | ${item.priority || ''} |`),
    '',
    '## How To Run',
    '',
    '```bash',
    'npm run test:readiness',
    'npm run test:readiness -- --no-start',
    'npm run test:readiness -- --keep-running',
    '```',
    '',
  ];
  fs.writeFileSync(reportPath, `${lines.join('\n')}\n`);
  console.log(`\nReport written to ${path.relative(rootDir, reportPath)}`);
}

async function cleanup() {
  if (keepRunning) {
    if (startedProcesses.length) {
      console.log('\nKeeping started services running:');
      for (const processInfo of startedProcesses) console.log(`- ${processInfo.name} (${processInfo.logPath})`);
    }
    return;
  }
  for (const processInfo of startedProcesses.reverse()) {
    if (verbose) console.log(`Stopping ${processInfo.name}`);
    processInfo.child.kill('SIGTERM');
  }
  await sleep(500);
}

async function main() {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log('Hotel CRM system readiness check\n');
  try {
    testStaticConfig();
    testDocker();
    await testRedis();
    await testDatabase();
    await testServiceStartupAndHealth();
    await testGatewayRoutes();
    await testFrontend();
  } finally {
    writeReport();
    await cleanup();
  }

  const failures = results.filter((item) => item.status === 'FAIL').length;
  process.exitCode = failures ? 1 : 0;
}

main().catch(async (error) => {
  addResult('Readiness script', 'unexpected error', 'FAIL', error.stack || error.message, 'P0');
  writeReport();
  await cleanup();
  process.exitCode = 1;
});
