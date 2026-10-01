'use strict';
// Decide whether a job is one the candidate can actually get, how well it fits, and whether it
// invites applications by email.
const cfg = require('./config');
const { skills, offStack, tooJunior, senior, projects, skipEmployerPlaces } = require('./profile');

// ---- Location: must be open to someone living in Bangladesh.
const OPEN = /\b(worldwide|anywhere|everywhere|global(ly)?|all countries|any (country|location|timezone)|asia|apac|south asia|bangladesh|utc\s?\+\s?[3-8])\b/i;
const CLOSED = /\b(us|u\.s\.|usa|united states|north america|americas|canada|pt\/et|est|pst|et hours|us hours|us time ?zones?|uk only|united kingdom only|eu only|europe only|emea|latam|latin america|brazil|germany|france|spain|poland|netherlands|australia|india only|must (be|reside|live) in|citizens? only|work authori[sz]ation|security clearance|green card|onsite|on-site|hybrid)\b/i;

const DESC_LOCK = /(remote (with)?in (the )?(eu|europe|us|usa|uk|latam|americas)|fully remote in the eu|(based|located|reside|residing|live) in (europe|the eu|the us|the usa|the united states|the uk|latin america|latam|the americas|europe or the americas|south africa|canada|india|the philippines)|europe or the americas|(eu|us|uk|europe|latam)[- ]only|talent from south africa|professionals from latin america|talent the philippines|from north america, south america,? and europe|within (the )?(eu|eea))/i;

// Optional personal rule: skip employers or roles in places you don't want to work for
// (profile.skipEmployerPlaces, a list of place names). A role that is open worldwide still
// passes on its location field; an employer that says it is based there does not.
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, (c) => '\\' + c);
const SKIP = skipEmployerPlaces && skipEmployerPlaces.length
  ? skipEmployerPlaces.map((p) => escapeRe(p.toLowerCase())).join('|')
  : null;
const SKIP_PLACE = SKIP && new RegExp('\\b(' + SKIP + ')\\b', 'i');
const SKIP_EMPLOYER = SKIP && new RegExp('\\b(headquartered|based|offices?) in (the )?(' + SKIP + ')\\b', 'i');
function employerSkipped(job) {
  if (!SKIP) return false;
  const loc = String(job.location || '');
  if (SKIP_PLACE.test(loc) && !/worldwide|anywhere|global/i.test(loc)) return true;
  return SKIP_EMPLOYER.test(job.text.slice(0, 6000));
}

function locationOk(job) {
  if (employerSkipped(job)) return false;
  const loc = String(job.location || '').trim();
  const text = job.text.slice(0, 4000);
  if (/\b(us citizens?|security clearance|must be (located|based) in the (us|united states))\b/i.test(text)) return false;
  // Descriptions often lock the location even when the feed says "Worldwide".
  if (DESC_LOCK.test(job.text) && !/\b(bangladesh|south asia|worldwide|anywhere in the world)\b/i.test(job.text)) return false;
  if (/^(worldwide|open to bangladesh)$/i.test(loc)) return true;
  if (!loc || OPEN.test(loc)) return !/\b(onsite|on-site)\b/i.test(loc);
  if (job.source === 'Company board') {
    // The company's own field: any place named besides "remote" (a city, country or region) locks it,
    // unless the title itself says worldwide (some boards tag each worldwide copy with a city).
    if (/\b(worldwide|anywhere)\b/i.test(job.title)) return true;
    const rest = loc.replace(/\b(remote|fully remote|100% remote)\b/ig, '').replace(/[()\-,/|;]+/g, ' ').trim();
    return !rest || OPEN.test(rest);
  }
  if (job.source === 'Hacker News') {
    // HN header line: needs REMOTE and no country lock, unless it explicitly says worldwide.
    if (!/\bremote\b/i.test(loc)) return false;
    return OPEN.test(loc) || !CLOSED.test(loc.replace(/\bremote\b/ig, ''));
  }
  return !CLOSED.test(loc) && /\b(remote)\b/i.test(loc);
}

// ---- Fit
function fit(job) {
  const title = job.title.toLowerCase();
  const body = job.text.toLowerCase().slice(0, 12000);
  if (offStack.some((r) => r.test(title))) return { score: 0, why: ['off-stack title'] };
  if (tooJunior.test(title)) return { score: 0, why: ['junior'] };
  if (!/engineer|developer|architect|full[- ]?stack|backend|back[- ]end|programmer|tech lead|cto/.test(title)
      && job.source !== 'Hacker News') return { score: 0, why: ['not an engineering title'] };

  let score = 0;
  const why = [];
  for (const [re, w] of skills) {
    const inTitle = re.test(title);
    const inBody = re.test(body);
    if (inTitle || inBody) {
      score += w * (inTitle ? 2 : 1);
      why.push(re.source.split('|')[0].replace(/\\\./g, '.').replace(/\\b|\\|\[[^\]]*\]\??|[()?]/g, ' ').replace(/\s+/g, ' ').trim());
    }
  }
  if (senior.test(title)) { score += 3; why.push('senior'); }
  // Platform-specialist roles (deep Shopify/Liquid, WordPress-only) aren't his profile.
  if (/\bshopify\b|\bliquid\b|\bhydrogen\b/.test(title)) score -= 15;
  if (offStack.some((r) => r.test(body)) && score < 10) score -= 4;
  // Generic titles that are really .NET/Java shops.
  if (/\b(c#|asp\.net|\.net core|mssql|t-?sql)\b/.test(body) && !/\b(php|laravel|node)\b/.test(title)) score -= 12;
  if (job.salaryMonthlyUsd) {
    if (job.salaryMonthlyUsd < cfg.minMonthlyUsd) return { score: 0, why: [`pay ~$${job.salaryMonthlyUsd}/mo`] };
    score += 2; why.push(`~$${job.salaryMonthlyUsd}/mo`);
  }
  return { score, why };
}

// ---- Which two projects to lead with
function pickProjects(job) {
  const t = (job.title + ' ' + job.text).toLowerCase();
  const ranked = projects
    .map((p) => ({ p, n: (t.match(new RegExp(p.match.source, 'g')) || []).length }))
    .sort((a, b) => b.n - a.n);
  const top = ranked.filter((r) => r.n > 0).slice(0, 2).map((r) => r.p);
  return top.length ? top : [projects[0], projects[1]];
}

// ---- Email application address: only when the post clearly asks for one.
const EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const BAD_LOCAL = /^(no-?reply|donotreply|privacy|legal|security|abuse|support|help|billing|press|media|dpo|gdpr|unsubscribe|info@example)/i;
const JOBS_LOCAL = /^(jobs?|careers?|hiring|hire|recruit(ing|ment)?|talent|apply|applications?|hr|people|join|work|engineering|cv|resumes?)$/i;
const ASKS = /(email|e-mail|send|reach out|write|contact|apply|drop)[^.\n]{0,80}$/i;

function deobfuscate(text) {
  return text
    .replace(/\s*[[(]\s*at\s*[\])]\s*/gi, '@').replace(/\s+at\s+(?=[a-z0-9-]+\s*[[(]?\s*dot)/gi, '@')
    .replace(/\s*[[(]\s*dot\s*[\])]\s*/gi, '.').replace(/(@[a-z0-9-]+)\s+dot\s+([a-z]{2,})/gi, '$1.$2');
}

function applicationEmail(job) {
  const text = deobfuscate(job.text);
  for (const m of text.matchAll(EMAIL)) {
    const addr = m[0].replace(/\.$/, '').toLowerCase();
    const local = addr.split('@')[0];
    if (BAD_LOCAL.test(local) || /example\.|sentry|wixpress|\.png|\.jpg/.test(addr)) continue;
    const before = text.slice(Math.max(0, m.index - 100), m.index);
    if (JOBS_LOCAL.test(local) || ASKS.test(before)) return addr;
  }
  return null;
}

function assess(job) {
  const ageDays = job.date ? (Date.now() - new Date(job.date).getTime()) / 864e5 : 0;
  if (ageDays > (job.maxAgeDays || cfg.maxAgeDays)) return { ...job, eligible: false, score: 0, why: ['stale'] };
  if (!locationOk(job)) return { ...job, eligible: false, score: 0, why: ['location locked'] };
  const f = fit(job);
  return {
    ...job, eligible: f.score > 0, score: f.score, why: f.why,
    projects: pickProjects(job), email: applicationEmail(job),
    openExplicit: /^(worldwide|open to bangladesh)$/i.test(String(job.location).trim()) || OPEN.test(job.location),
  };
}

module.exports = { assess, locationOk, applicationEmail, fit };
