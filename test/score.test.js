'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { locationOk, applicationEmail, assess } = require('../src/score');
const { excluded } = require('../src/exclude');

const job = (over) => ({
  id: 't:1', source: 'Remotive', title: 'Senior Full Stack Engineer', company: 'Acme',
  location: 'Worldwide', text: 'We build a SaaS with Node.js, TypeScript and PostgreSQL.',
  date: new Date().toISOString(), ...over,
});

test('worldwide roles pass, country locked roles do not', () => {
  assert.equal(locationOk(job({ location: 'Worldwide' })), true);
  assert.equal(locationOk(job({ location: 'USA Only' })), false);
  assert.equal(locationOk(job({ location: 'Remote, EMEA' })), false);
});

test('a description can lock a role the feed calls worldwide', () => {
  const j = job({ text: 'Fully remote, but you must be based in the US for payroll reasons.' });
  assert.equal(locationOk(j), false);
});

test('company boards: bare "Remote" passes, a named place locks it', () => {
  const b = (location, title = 'Backend Engineer') => job({ source: 'Company board', location, title });
  assert.equal(locationOk(b('Remote')), true);
  assert.equal(locationOk(b('Sweden (Remote)')), false);
  assert.equal(locationOk(b('Remote, U.S.')), false);
  assert.equal(locationOk(b('Foster City, CA (Remote)')), false);
  assert.equal(locationOk(b('Lisbon, Portugal (Remote)', 'Node.js Engineer (100% Remote, Worldwide)')), true);
});

test('Hacker News headers need REMOTE and no country lock', () => {
  const hn = (location) => job({ source: 'Hacker News', location });
  assert.equal(locationOk(hn('Acme | Senior Engineer | REMOTE (Worldwide) | $150k')), true);
  assert.equal(locationOk(hn('Acme | Senior Engineer | REMOTE (US only)')), false);
  assert.equal(locationOk(hn('Acme | Senior Engineer | San Francisco | Onsite')), false);
});

test('only addresses the post asks you to use count as application emails', () => {
  assert.equal(applicationEmail(job({ text: 'To apply, send your CV to jobs@acme.io.' })), 'jobs@acme.io');
  assert.equal(applicationEmail(job({ text: 'Questions? privacy@acme.io handles data requests.' })), null);
  assert.equal(applicationEmail(job({ text: 'Email hiring [at] acme [dot] io with your work.' })), 'hiring@acme.io');
});

test('stale, junior and off stack jobs are dropped', () => {
  const old = new Date(Date.now() - 60 * 864e5).toISOString();
  assert.equal(assess(job({ date: old })).eligible, false);
  assert.equal(assess(job({ title: 'Junior Developer' })).eligible, false);
  assert.equal(assess(job({ title: 'Senior Java Engineer' })).eligible, false);
  assert.equal(assess(job()).eligible, true);
});

test('exclusion list: cooldown for applied, permanent for dead ends', () => {
  const list = {
    applied: [{ company: 'Acme', date: new Date().toISOString().slice(0, 10) }, { company: 'Oldco', date: '2020-01-01' }],
    deadEnds: ['Nowhere Labs'],
  };
  assert.equal(excluded(job({ company: 'Acme Inc' }), list), 'applied');
  assert.equal(excluded(job({ company: 'Oldco' }), list), false);
  assert.equal(excluded(job({ company: 'Nowhere Labs GmbH' }), list), 'dead end');
  assert.equal(excluded(job({ company: 'Someone Else' }), list), false);
});
