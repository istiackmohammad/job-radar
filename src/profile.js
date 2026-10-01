'use strict';
// Who is applying, and the evidence each kind of job gets pointed at.
// Every claim here is on the CV; do not add anything that is not.

const person = {
  name: 'Istiack Mohammad',
  title: 'Senior Full-Stack Engineer',
  portfolio: 'https://isti.studio',
  linkedin: 'https://www.linkedin.com/in/istiackmohammad/',
  github: 'https://github.com/istiackmohammad',
  location: 'Bangladesh (UTC+6), working with UK / EU / US-East overlap',
};

// Weighted skill terms. Matched on word boundaries against title (x2) + description.
const skills = [
  [/\blaravel\b/, 6], [/\bphp\b/, 4], [/\bvue(\.?js)?\b/, 4], [/\bnode(\.?js)?\b/, 3],
  [/\btypescript\b/, 3], [/\bnext\.?js\b/, 2], [/\breact\b/, 1], [/\btailwind\b/, 1],
  [/\bfull[- ]?stack\b/, 3], [/\bbackend\b|\bback[- ]end\b/, 2],
  [/\be-?commerce\b|\bshopify\b|\bwoocommerce\b|\bcheckout\b/, 4],
  [/\bsaas\b|\bmulti[- ]tenan/, 3], [/\bpostgres(ql)?\b/, 2], [/\bmysql\b/, 2],
  [/\bstripe\b|\bpayments?\b/, 2], [/\bintegrations?\b|\bwebhooks?\b|\brest(ful)? api/, 2],
  [/\bconversions? api\b|\bgtm\b|\btag manager\b|\bga4\b|\battribution\b|\btracking\b/, 3],
  [/\bnginx\b|\blinux\b|\bdevops\b|\bdocker\b/, 1], [/\bpwa\b/, 1],
];

// Stacks that mean this is somebody else's job.
const offStack = [
  /\b(java|kotlin|scala|golang|rust|elixir|ruby on rails|salesforce|sap|abap|django|flask)\b|c#|\.net\b|\bdotnet\b/,
  /\b(ios|android|swift|flutter) (engineer|developer)\b/,
  /\b(data scientist|machine learning engineer|ml engineer|sre|security engineer|qa engineer)\b/,
  /\b(mobile|ios|android)( platform)? engineer\b|\bqa\b|quality engineering|\bgrc\b|\bmes\b|devops engineer|security architect|\bdrupal\b/,
];
const tooJunior = /\b(junior|intern(ship)?|graduate|entry[- ]level|apprentice)\b/;
const senior = /\b(senior|sr\.?|lead|staff|principal|architect)\b/;

// Evidence blocks. The job's text picks the best two.
const projects = [
  {
    key: 'commerce',
    match: /e-?commerce|shopify|woocommerce|checkout|store|retail|marketplace|orders?|inventory|logistics|laravel/,
    line: 'I lead development and operations for five live online stores (Bangladesh and UK) on Laravel/Vue: checkout, inventory, courier integrations and COD reconciliation. I recently cut an 18.5-second admin page to one query plan fix with EXPLAIN ANALYZE.',
  },
  {
    key: 'saas',
    match: /saas|multi[- ]tenan|b2b|platform|postgres|typescript|node/,
    line: 'I designed and built KeyHold Pro, a multi-tenant inspection SaaS (Node.js/TypeScript, PostgreSQL row-level security) that replaced a US firm\'s third-party product and is in daily production use, backed by 336 automated tests.',
  },
  {
    key: 'tracking',
    match: /tracking|attribution|analytics|conversion|pixel|gtm|tag manager|ga4|growth|marketing/,
    line: 'I diagnose ad measurement end to end: I proved a client\'s broken ROAS came from duplicated zero-value Meta Purchase events by reconciling store orders against Meta day by day, and I run server-side Conversions API with deduplication and consent mode.',
  },
  {
    key: 'integrations',
    match: /integrations?|api|webhook|payments?|stripe|sms|notifications?|messaging/,
    line: 'I build the integrations real money flows through: Stripe, bKash, courier APIs, WhatsApp Cloud API, GoHighLevel webhooks, and an SMS pipeline with my own Android gateway app delivering transactional SMS in 3-6 seconds.',
  },
  {
    key: 'ops',
    match: /devops|infrastructure|reliab|on-?call|incident|linux|nginx|security|performance/,
    line: 'I own production, not just code: I restored a store\'s checkout after a 54-minute outage and hardened the order transaction, and cleaned web shells out of a Laravel marketplace and closed the upload hole they came through.',
  },
];

// Place names whose employers you'd rather skip, e.g. ['Atlantis']. Empty means no rule.
const skipEmployerPlaces = [];

module.exports = { person, skills, offStack, tooJunior, senior, projects, skipEmployerPlaces };
