'use strict';
// Write the application email and the daily digest. Plain, specific, short.
const { person } = require('./profile');

const esc = (s) => String(s || '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clean = (s, n = 90) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

function roleName(job) {
  return clean(job.title, 80).replace(/\s*\((remote|m\/f\/d|f\/m\/d)\)\s*/ig, ' ').trim();
}

function application(job) {
  const role = roleName(job);
  const company = clean(job.company, 60);
  const [a, b] = job.projects;
  const subject = `${role} - ${person.name} (Senior Full-Stack Engineer)`;
  const text = [
    `Hi ${company} team,`,
    '',
    `I'd like to apply for the ${role} role${job.source === 'Hacker News' ? ' you posted on Hacker News' : ''}.`,
    '',
    a.line,
    b && b !== a ? '' : null,
    b && b !== a ? b.line : null,
    '',
    'My day-to-day stack is Laravel/PHP, Node.js/TypeScript, Vue/React, MySQL and PostgreSQL, and I own work end to end: architecture, build, deployment and production.',
    '',
    `Portfolio: ${person.portfolio}`,
    `LinkedIn: ${person.linkedin}`,
    'CV attached.',
    '',
    `I'm based in ${person.location}. Happy to do a call or a paid trial task.`,
    '',
    'Best regards,',
    person.name,
  ].filter((l) => l !== null).join('\n');
  return { subject, text };
}

// A short note to paste into an application form.
function formNote(job) {
  const [a, b] = job.projects;
  return [a.line, b && b !== a ? b.line : null].filter(Boolean).join(' ');
}

function digest({ sent, shortlist, stats, dryRun }) {
  const date = new Date().toISOString().slice(0, 10);
  const row = (j) => `
    <tr><td style="padding:14px 0;border-bottom:1px solid #e5e7eb">
      <div style="font:600 15px/1.35 Arial"><a href="${esc(j.applyUrl)}" style="color:#1f3a5f">${esc(roleName(j))}</a></div>
      <div style="font:13px/1.5 Arial;color:#555">${esc(j.company)} &middot; ${esc(clean(j.location, 60))} &middot; score ${j.score}
        &middot; via <a href="${esc(j.sourceUrl)}" style="color:#555">${esc(j.source)}</a></div>
      <div style="font:12px/1.5 Arial;color:#777">matched: ${esc(j.why.slice(0, 8).join(', '))}</div>
      <div style="font:13px/1.5 Arial;color:#222;background:#f6f7f9;padding:8px 10px;margin-top:6px;border-radius:4px">${esc(formNote(j))}</div>
    </td></tr>`;
  const sentRows = sent.map((j) => `<li style="font:13px/1.6 Arial">${esc(roleName(j))} &mdash; ${esc(j.company)} &rarr; <b>${esc(j.email)}</b>${dryRun ? ' <i>(dry run, not sent)</i>' : ''}</li>`).join('');
  const html = `<div style="max-width:680px;margin:auto">
    <h2 style="font:700 20px Arial;margin:0 0 4px">Job shortlist &mdash; ${date}</h2>
    <p style="font:13px Arial;color:#555;margin:0 0 16px">${stats.fetched} jobs scanned &middot; ${stats.eligible} open to Bangladesh and on-stack &middot; ${sent.length} emailed &middot; ${shortlist.length} to apply by form</p>
    ${sent.length ? `<h3 style="font:700 15px Arial">Applied by email${dryRun ? ' (DRY RUN)' : ''}</h3><ul>${sentRows}</ul><p style="font:12px Arial;color:#777">Replies come to your inbox.</p>` : ''}
    <h3 style="font:700 15px Arial;margin-top:20px">Apply by form (note ready to paste)</h3>
    <table style="width:100%;border-collapse:collapse">${shortlist.map(row).join('')}</table>
  </div>`;
  const text = `Job shortlist ${date}\n\nEmailed:\n${sent.map((j) => `- ${roleName(j)} @ ${j.company} -> ${j.email}`).join('\n') || '- none'}\n\nApply by form:\n${shortlist.map((j) => `- [${j.score}] ${roleName(j)} @ ${j.company}\n  ${j.applyUrl}`).join('\n')}`;
  return { subject: `Job shortlist ${date}: ${sent.length} applied, ${shortlist.length} to review`, html, text };
}

module.exports = { application, formNote, digest, roleName };
