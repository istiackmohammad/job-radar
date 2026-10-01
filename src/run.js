'use strict';
/*
 * Daily job run.
 *   node src/run.js --dry-run   collect + score + write preview files; sends nothing
 *   add --preview               ...and don't mark the listed jobs as seen (for testing)
 *   node src/run.js             same, then email-applies (only if AUTO_SEND=1) and mails the digest
 *
 * Safety: at most MAX_AUTO_EMAILS_PER_DAY applications, one per company per
 * COMPANY_COOLDOWN_DAYS, never the same job twice, only to addresses the post asks you to use.
 */
const fs = require('fs');
const path = require('path');
const cfg = require('./config');
const { fetchAll } = require('./sources');
const { assess } = require('./score');
const compose = require('./compose');
const store = require('./store');
const { excluded, loadList } = require('./exclude');

const dryRun = process.argv.includes('--dry-run') || !cfg.autoSend;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

function transport() {
  if (!cfg.smtp.host || !cfg.smtp.user || !cfg.smtp.pass) return null;
  const nodemailer = require('nodemailer');
  return nodemailer.createTransport({
    host: cfg.smtp.host, port: cfg.smtp.port, secure: cfg.smtp.port === 465,
    auth: { user: cfg.smtp.user, pass: cfg.smtp.pass },
  });
}

(async () => {
  log(`job-hunt start (${dryRun ? 'DRY RUN' : 'LIVE'})`);
  const state = store.load();
  const raw = await fetchAll((m) => log(m));

  // de-duplicate across sources by company + title
  const byKey = new Map();
  for (const j of raw) {
    const co = j.company.toLowerCase().replace(/\b(inc|llc|ltd|gmbh|corp|co|limited)\b\.?/g, '');
    const k = (co + '|' + j.title).toLowerCase().replace(/[^a-z0-9|]/g, '');
    if (!byKey.has(k)) byKey.set(k, j);
  }
  const assessed = [...byKey.values()].map(assess);
  const eligible = assessed.filter((j) => j.eligible && j.score >= cfg.minScoreForDigest)
    .sort((a, b) => b.score - a.score);
  const list = loadList();
  const skipped = eligible.filter((j) => excluded(j, list));
  const fresh = eligible.filter((j) => !state.seen[j.id] && !excluded(j, list));
  log(`fetched ${raw.length}, unique ${byKey.size}, eligible ${eligible.length}, already applied/ruled out ${skipped.length}, new ${fresh.length}`);

  // ---- email applications
  const mailer = dryRun ? null : transport();
  if (!dryRun && !mailer) log('SMTP not configured: nothing will be sent');
  const cvOk = fs.existsSync(cfg.cvPath);
  if (!cvOk) log(`CV not found at ${cfg.cvPath}: email applications disabled`);
  const sent = [];
  let budget = cfg.maxAutoEmailsPerDay - store.sentToday(state);
  for (const job of fresh) {
    if (budget <= 0) break;
    if (!job.email || !job.openExplicit || job.score < cfg.minScoreToApply || !cvOk) continue;
    if (store.recentlyContacted(state, job)) continue;
    const mail = compose.application(job);
    if (!dryRun && mailer) {
      try {
        await mailer.sendMail({
          from: cfg.from, replyTo: cfg.replyTo, to: job.email, subject: mail.subject, text: mail.text,
          attachments: [{ filename: require('path').basename(cfg.cvPath), path: cfg.cvPath }],
        });
      } catch (e) {
        log(`send failed ${job.email}: ${e.message}`);
        continue;
      }
    }
    if (!dryRun) state.applied.push({ at: Date.now(), id: job.id, company: job.company, title: job.title, email: job.email });
    sent.push(job);
    budget--;
    log(`${dryRun ? 'would email' : 'emailed'} ${job.email}  [${job.score}] ${job.title} @ ${job.company}`);
  }

  // ---- digest: best of the rest
  const sentIds = new Set(sent.map((j) => j.id));
  const shortlist = fresh.filter((j) => !sentIds.has(j.id)).slice(0, cfg.digestSize);
  const d = compose.digest({ sent, shortlist, stats: { fetched: raw.length, eligible: eligible.length }, dryRun });

  const outDir = path.join(cfg.ROOT, 'data', 'out');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'digest.html'), d.html);
  fs.writeFileSync(path.join(outDir, 'applications.txt'),
    sent.map((j) => { const m = compose.application(j); return `TO: ${j.email}\nSUBJECT: ${m.subject}\n\n${m.text}\n\n${'='.repeat(70)}\n`; }).join('\n'));

  // Shown once is enough: tomorrow's digest moves on to jobs not yet listed.
  if (!process.argv.includes('--preview')) for (const j of [...sent, ...shortlist]) state.seen[j.id] = Date.now();
  if (dryRun) {
    log(`dry run: preview written to ${outDir}`);
  } else {
    const m = transport();
    if (m) {
      await m.sendMail({ from: cfg.from, to: cfg.digestTo, subject: d.subject, html: d.html, text: d.text });
      log(`digest mailed to ${cfg.digestTo}`);
    }
  }
  store.save(state);
  log('done');
})().catch((e) => {
  console.error('job-hunt failed:', e);
  process.exit(1);
});
