'use strict';
// Tiny JSON state: which jobs were seen, which companies were emailed and when.
// Written atomically so a crash mid-run can never leave a half file.
const fs = require('fs');
const path = require('path');
const cfg = require('./config');

function load() {
  try {
    return JSON.parse(fs.readFileSync(cfg.stateFile, 'utf8'));
  } catch {
    return { seen: {}, applied: [] };
  }
}

function save(state) {
  fs.mkdirSync(path.dirname(cfg.stateFile), { recursive: true });
  const cutoff = Date.now() - 120 * 864e5;
  for (const [id, t] of Object.entries(state.seen)) if (t < cutoff) delete state.seen[id];
  const tmp = cfg.stateFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(state, null, 1));
  fs.renameSync(tmp, cfg.stateFile);
}

const companyKey = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
const domainOf = (email) => String(email || '').split('@')[1] || '';

function recentlyContacted(state, job) {
  const cutoff = Date.now() - cfg.companyCooldownDays * 864e5;
  return state.applied.some((a) => a.at > cutoff && (
    companyKey(a.company) === companyKey(job.company) || (job.email && domainOf(a.email) === domainOf(job.email))
  ));
}

function sentToday(state) {
  const day = new Date().toISOString().slice(0, 10);
  return state.applied.filter((a) => !a.dryRun && new Date(a.at).toISOString().slice(0, 10) === day).length;
}

module.exports = { load, save, recentlyContacted, sentToday };
