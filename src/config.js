'use strict';
// All settings come from the environment (or a .env file next to package.json).
// Nothing secret lives in this repo.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const envFile = path.join(ROOT, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

const env = (k, d) => (process.env[k] !== undefined && process.env[k] !== '' ? process.env[k] : d);
const int = (k, d) => {
  const n = parseInt(env(k, ''), 10);
  return Number.isFinite(n) ? n : d;
};

module.exports = {
  ROOT,
  stateFile: env('STATE_FILE', path.join(ROOT, 'data', 'state.json')),
  cvPath: env('CV_PATH', path.join(ROOT, 'cv.pdf')),
  excludeFile: env('EXCLUDE_FILE', path.join(ROOT, 'data', 'exclude.json')),

  // Sending is OFF unless AUTO_SEND=1. The digest is still built (and mailed if SMTP is set).
  autoSend: env('AUTO_SEND', '0') === '1',
  maxAutoEmailsPerDay: int('MAX_AUTO_EMAILS_PER_DAY', 8),
  companyCooldownDays: int('COMPANY_COOLDOWN_DAYS', 90),
  minScoreToApply: int('MIN_SCORE_TO_APPLY', 14),
  minScoreForDigest: int('MIN_SCORE_FOR_DIGEST', 9),
  digestSize: int('DIGEST_SIZE', 15),
  maxAgeDays: int('MAX_AGE_DAYS', 14),
  minMonthlyUsd: int('MIN_MONTHLY_USD', 3000),

  smtp: {
    host: env('SMTP_HOST', ''),
    port: int('SMTP_PORT', 465),
    user: env('SMTP_USER', ''),
    pass: env('SMTP_PASS', ''),
  },
  from: env('MAIL_FROM', ''),
  replyTo: env('REPLY_TO', ''),
  digestTo: env('DIGEST_TO', ''),
  userAgent: `Mozilla/5.0 (job-radar; personal use; contact ${env('CONTACT_EMAIL', 'unset')})`,
};
