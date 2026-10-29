// Generates a local .env from .env.example, replacing every CHANGE_ME with a random secret.
// Secrets are created on the developer's machine, so nothing sensitive is ever committed.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.resolve(__dirname, '..');
const target = path.join(root, '.env');

if (fs.existsSync(target)) {
  console.log('.env already exists, leaving it untouched.');
  process.exit(0);
}

const template = fs.readFileSync(path.join(root, '.env.example'), 'utf8');

// Each key gets a secret in the format it expects.
const generators = {
  FIELD_ENCRYPTION_KEY: () => crypto.randomBytes(32).toString('base64'),
  JWT_SECRET: () => crypto.randomBytes(48).toString('base64url'),
  RISK_WEBHOOK_SECRET: () => crypto.randomBytes(48).toString('base64url'),
};
const defaultGenerator = () => crypto.randomBytes(18).toString('base64url');

const output = template
  .split('\n')
  .map((line) => {
    const match = line.match(/^([A-Z0-9_]+)=CHANGE_ME$/);
    if (!match) return line;
    const key = match[1];
    const generate = generators[key] ?? defaultGenerator;
    return `${key}=${generate()}`;
  })
  .join('\n');

fs.writeFileSync(target, output, { mode: 0o600 });
console.log('.env created with freshly generated local secrets.');
