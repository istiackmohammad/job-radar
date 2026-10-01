'use strict';
// Companies you've already applied to (skipped for a cooldown) and dead ends (skipped for good),
// kept outside the code in data/exclude.json so the list stays private. See exclude.example.json.
const fs = require('fs');
const cfg = require('./config');

const key = (s) => String(s || '').toLowerCase().replace(/\b(inc|llc|ltd|gmbh|corp|limited)\b\.?/g, '').replace(/[^a-z0-9]/g, '');

function loadList(file = cfg.excludeFile) {
  try {
    const d = JSON.parse(fs.readFileSync(file, 'utf8'));
    return { applied: d.applied || [], deadEnds: d.deadEnds || [] };
  } catch {
    return { applied: [], deadEnds: [] };
  }
}

// applied: [{ company, date: 'YYYY-MM-DD' }], deadEnds: ['Company', ...]
function excluded(job, list = loadList(), now = Date.now()) {
  const co = key(job.company);
  if (!co) return false;
  const hit = (name) => { const k = key(name); return k.length >= 4 && co.startsWith(k); };
  if (list.deadEnds.some(hit)) return 'dead end';
  const cooldown = cfg.companyCooldownDays * 864e5;
  if (list.applied.some((a) => hit(a.company) && now - Date.parse(a.date) < cooldown)) return 'applied';
  return false;
}

module.exports = { excluded, loadList };
