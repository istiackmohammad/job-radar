'use strict';
// Fetch remote jobs from sources that publish a feed for this purpose, and normalise them to:
// { id, source, sourceUrl, title, company, location, url, applyUrl, text, salaryMonthlyUsd, date }
const cfg = require('./config');

const H = { 'User-Agent': cfg.userAgent, Accept: 'application/json, text/xml, */*' };

async function get(url, as = 'json') {
  const r = await fetch(url, { headers: H, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return as === 'json' ? r.json() : r.text();
}

const decode = (s) => String(s || '')
  .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
const toText = (html) => decode(String(html || '')
  .replace(/<a [^>]*href="mailto:([^"]+)"[^>]*>.*?<\/a>/gi, ' $1 ')
  .replace(/<(br|p|li|div|h\d)[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
  .replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

// Yearly/monthly/hourly -> monthly USD. Unknown period with a big number is treated as yearly.
function monthly(min, max, period) {
  const v = Number(max || min) || 0;
  if (!v) return null;
  const p = String(period || '').toLowerCase();
  if (p.startsWith('hour')) return Math.round(v * 160);
  if (p.startsWith('month')) return Math.round(v);
  if (p.startsWith('year') || p.startsWith('annual') || v > 20000) return Math.round(v / 12);
  return Math.round(v);
}
function parseSalaryText(s) {
  const m = String(s || '').replace(/,/g, '').match(/\$?\s?(\d{2,3})(k|\d{3})\s*(?:-|–|to)\s*\$?\s?(\d{2,3})(k|\d{3})/i);
  if (!m) return null;
  const hi = m[4].toLowerCase() === 'k' ? +m[3] * 1000 : +(m[3] + m[4]);
  return hi > 20000 ? Math.round(hi / 12) : null;
}

async function remotive() {
  const d = await get('https://remotive.com/api/remote-jobs?category=software-dev');
  return d.jobs.map((j) => ({
    id: `remotive:${j.id}`, source: 'Remotive', sourceUrl: j.url,
    title: j.title, company: j.company_name, location: j.candidate_required_location || '',
    url: j.url, applyUrl: j.url, text: toText(j.description),
    salaryMonthlyUsd: parseSalaryText(j.salary), date: j.publication_date,
  }));
}

async function remoteok() {
  const d = await get('https://remoteok.com/api');
  return d.filter((j) => j && j.id && j.position).map((j) => ({
    id: `remoteok:${j.id}`, source: 'Remote OK', sourceUrl: j.url,
    title: decode(j.position), company: decode(j.company), location: j.location || '',
    url: j.url, applyUrl: j.apply_url || j.url, text: toText(j.description) + '\n' + (j.tags || []).join(' '),
    salaryMonthlyUsd: monthly(j.salary_min, j.salary_max, 'year'), date: j.date,
  }));
}

// Himalayas search, restricted to jobs that accept candidates in Bangladesh.
async function himalayas() {
  const queries = ['full stack', 'laravel', 'php', 'backend', 'node', 'vue', 'typescript', 'ecommerce', 'saas',
    'wordpress', 'woocommerce', 'react', 'next.js', 'javascript', 'web developer', 'api', 'integrations', 'software engineer', 'developer'];
  const seen = new Set();
  const out = [];
  for (const q of queries) {
    for (let page = 1; page <= 3; page++) {
      const d = await get(`https://himalayas.app/jobs/api/search?country=Bangladesh&q=${encodeURIComponent(q)}&page=${page}`);
      for (const j of d.jobs || []) {
        if (seen.has(j.guid)) continue;
        seen.add(j.guid);
        const lr = j.locationRestrictions || [];
        out.push({
          id: `himalayas:${j.guid}`, source: 'Himalayas', sourceUrl: j.applicationLink,
          title: j.title, company: j.companyName,
          location: !lr.length ? 'Worldwide' : lr.includes('Bangladesh') ? 'Open to Bangladesh' : lr.join(', '),
          url: j.applicationLink, applyUrl: j.applicationLink,
          text: toText(j.description) + '\n' + (j.categories || []).join(' ') + ' ' + (j.seniority || []).join(' '),
          salaryMonthlyUsd: j.currency === 'USD' ? monthly(j.minSalary, j.maxSalary, j.salaryPeriod) : null,
          date: j.pubDate ? new Date(j.pubDate * 1000).toISOString() : null,
        });
      }
      if ((d.jobs || []).length < 20) break;
    }
  }
  return out;
}

async function jobicy() {
  const d = await get('https://jobicy.com/api/v2/remote-jobs?count=100&industry=dev');
  return (d.jobs || []).map((j) => ({
    id: `jobicy:${j.id}`, source: 'Jobicy', sourceUrl: j.url,
    title: decode(j.jobTitle), company: decode(j.companyName), location: j.jobGeo || '',
    url: j.url, applyUrl: j.url, text: toText(j.jobDescription) + '\n' + [].concat(j.jobLevel || []).join(' '),
    salaryMonthlyUsd: j.salaryCurrency === 'USD' ? monthly(j.annualSalaryMin, j.annualSalaryMax, 'year') : null,
    date: j.pubDate,
  }));
}

async function workingnomads() {
  const d = await get('https://www.workingnomads.com/api/exposed_jobs/');
  return d.filter((j) => /development|engineering|programming/i.test(j.category_name || '')).map((j) => ({
    id: `wn:${j.url}`, source: 'Working Nomads', sourceUrl: j.url,
    title: decode(j.title), company: decode(j.company_name), location: j.location || '',
    url: j.url, applyUrl: j.url, text: toText(j.description) + '\n' + (j.tags || ''),
    salaryMonthlyUsd: null, date: j.pub_date,
  }));
}

async function weworkremotely() {
  const feeds = ['remote-full-stack-programming-jobs', 'remote-back-end-programming-jobs', 'remote-front-end-programming-jobs'];
  const out = [];
  for (const f of feeds) {
    const xml = await get(`https://weworkremotely.com/categories/${f}.rss`, 'text');
    for (const item of xml.split('<item>').slice(1)) {
      const tag = (t) => decode(((item.match(new RegExp(`<${t}>([\\s\\S]*?)</${t}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, ''));
      const [company, ...rest] = tag('title').split(':');
      const link = tag('link').trim();
      out.push({
        id: `wwr:${link}`, source: 'We Work Remotely', sourceUrl: link,
        title: rest.join(':').trim() || tag('title'), company: company.trim(), location: tag('region') || '',
        url: link, applyUrl: link, text: toText(tag('description')),
        salaryMonthlyUsd: null, date: tag('pubDate') ? new Date(tag('pubDate')).toISOString() : null,
      });
    }
  }
  return out;
}

// Ask HN: Who is hiring? — the most recent monthly thread. Top-level comments only.
async function hackernews() {
  const s = await get('https://hn.algolia.com/api/v1/search_by_date?tags=story,author_whoishiring&query=who%20is%20hiring&hitsPerPage=5');
  const story = s.hits.find((h) => /who is hiring/i.test(h.title));
  if (!story) return [];
  const t = await get(`https://hn.algolia.com/api/v1/items/${story.objectID}`);
  return (t.children || []).filter((c) => c.text && c.author).map((c) => {
    const text = toText(c.text);
    const head = text.split('\n')[0];
    const parts = head.split('|').map((x) => x.trim());
    return {
      id: `hn:${c.id}`, source: 'Hacker News', sourceUrl: `https://news.ycombinator.com/item?id=${c.id}`,
      title: parts.find((p) => /engineer|developer|full|stack|backend|architect/i.test(p)) || parts[1] || head.slice(0, 80),
      company: parts[0].slice(0, 60), location: head,
      url: `https://news.ycombinator.com/item?id=${c.id}`, applyUrl: `https://news.ycombinator.com/item?id=${c.id}`,
      text, salaryMonthlyUsd: parseSalaryText(head), date: c.created_at, maxAgeDays: 40,
    };
  });
}

// Remote-first companies' own job boards (public ATS feeds). Fresher and more precise than
// aggregators: the location field is the company's own. Slugs checked 1 Oct 2026.
const BOARDS = {
  greenhouse: ['gitlab', 'canonical', 'wikimedia', 'mozilla', 'bitwarden', 'grafanalabs', 'elastic', 'webflow',
    'tailscale', 'planetscale', 'vercel'],
  ashby: ['posthog', 'supabase', 'zapier', 'n8n', 'resend', 'oyster', 'sanity', 'buffer', 'ghost', 'close',
    'linear', 'replit', 'clerk'],
  lever: ['toptal', 'kinsta'],
  recruitee: ['tether', 'holepunch'],
};
const ENG = /engineer|developer|full[- ]?stack|backend|back[- ]end|frontend|front[- ]end|programmer|architect/i;

async function companyBoards() {
  const out = [];
  const each = async (slugs, fn) => Promise.all(slugs.map((s) => fn(s).catch(() => [])));
  const gh = await each(BOARDS.greenhouse, async (s) => {
    const d = await get(`https://boards-api.greenhouse.io/v1/boards/${s}/jobs?content=true`);
    return (d.jobs || []).filter((j) => ENG.test(j.title)).map((j) => ({
      id: `gh:${s}:${j.id}`, source: 'Company board', sourceUrl: j.absolute_url,
      title: j.title, company: j.company_name || s, location: (j.location && j.location.name) || '',
      url: j.absolute_url, applyUrl: j.absolute_url, text: toText(decode(j.content)),
      salaryMonthlyUsd: null, date: j.first_published || j.updated_at,
    }));
  });
  const ab = await each(BOARDS.ashby, async (s) => {
    const d = await get(`https://api.ashbyhq.com/posting-api/job-board/${s}?includeCompensation=true`);
    return (d.jobs || []).filter((j) => j.isListed !== false && ENG.test(j.title)).map((j) => ({
      id: `ashby:${s}:${j.id}`, source: 'Company board', sourceUrl: j.jobUrl,
      title: j.title, company: s.charAt(0).toUpperCase() + s.slice(1),
      location: [j.location, ...(j.secondaryLocations || []).map((l) => l.location)].filter(Boolean).join(', ')
        + (j.isRemote && !/remote/i.test(j.location || '') ? ' (Remote)' : ''),
      url: j.jobUrl, applyUrl: j.applyUrl || j.jobUrl, text: j.descriptionPlain || toText(j.descriptionHtml),
      salaryMonthlyUsd: parseSalaryText(j.compensation && j.compensation.compensationTierSummary),
      date: j.publishedAt,
    }));
  });
  const lv = await each(BOARDS.lever, async (s) => {
    const d = await get(`https://api.lever.co/v0/postings/${s}?mode=json`);
    return d.filter((j) => ENG.test(j.text)).map((j) => ({
      id: `lever:${s}:${j.id}`, source: 'Company board', sourceUrl: j.hostedUrl,
      title: j.text, company: s.charAt(0).toUpperCase() + s.slice(1),
      location: ((j.categories && j.categories.allLocations) || [j.categories && j.categories.location]).filter(Boolean).join(', ')
        + (j.workplaceType === 'remote' ? ' (Remote)' : ''),
      url: j.hostedUrl, applyUrl: j.applyUrl || j.hostedUrl,
      text: [j.descriptionPlain, ...(j.lists || []).map((l) => l.text + '\n' + toText(l.content)), j.additionalPlain].join('\n'),
      salaryMonthlyUsd: null, date: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    }));
  });
  const rc = await each(BOARDS.recruitee, async (s) => {
    const d = await get(`https://${s}.recruitee.com/api/offers/`);
    return (d.offers || []).filter((j) => ENG.test(j.title)).map((j) => ({
      id: `recruitee:${s}:${j.id}`, source: 'Company board', sourceUrl: j.careers_url,
      title: j.title, company: j.company_name || s,
      location: j.remote && !(j.city || j.country) ? 'Remote' : [j.city, j.country].filter(Boolean).join(', ') + (j.remote ? ' (Remote)' : ''),
      url: j.careers_url, applyUrl: j.careers_apply_url || j.careers_url,
      text: toText(j.description) + '\n' + toText(j.requirements),
      salaryMonthlyUsd: null, date: j.published_at || j.created_at,
    }));
  });
  for (const list of [...gh, ...ab, ...lv, ...rc]) out.push(...list);
  return out;
}

const SOURCES = { remotive, remoteok, himalayas, jobicy, workingnomads, weworkremotely, hackernews, companyBoards };

async function fetchAll(log = console.log) {
  const all = [];
  for (const [name, fn] of Object.entries(SOURCES)) {
    try {
      const jobs = await fn();
      log(`  ${name.padEnd(15)} ${jobs.length} jobs`);
      all.push(...jobs);
    } catch (e) {
      log(`  ${name.padEnd(15)} FAILED: ${e.message}`);
    }
  }
  return all;
}

module.exports = { fetchAll, toText };
