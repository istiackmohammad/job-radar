# job-radar

A small tool I run every morning to find remote engineering jobs I can actually get.

Job boards are noisy for someone outside the US and Europe. A listing says "Worldwide" and the description says you must live in Portugal. A company says "Remote" and means remote within California. After a few weeks of opening those by hand I wrote this instead.

Every day at 03:30 London time it pulls about 1,600 roles, throws away the ones that are closed to my location or off my stack, scores the rest against work I've really done, and mails me a short list with a note I can paste into the application form. On a normal day that's 1,600 in and 15 or so out.

## What it does

1. **Collect.** Public feeds from Remotive, Remote OK, Himalayas, Jobicy, Working Nomads, We Work Remotely and the monthly Hacker News "Who is hiring" thread, plus the public job board APIs of about 25 remote first companies on Greenhouse, Ashby, Lever and Recruitee. Company boards are the best source because the location field comes from the company itself rather than an aggregator's guess.
2. **Filter.** A role has to be open to where I live. That sounds simple and is most of the code: the location field, the title and the description can each disagree, so `src/score.js` checks all three. Company boards are strict (any named city or country locks a role unless the title says worldwide), Hacker News headers need REMOTE with no country lock, and a description that says "must be based in the EU" overrides a feed that says "Worldwide".
3. **Score.** Skills are weighted by how much of my real work they cover, matched on word boundaries, counted double in the title. Junior titles, other stacks and pay below a floor are dropped. The two pieces of my own work that best fit the post are picked out for the note.
4. **Skip what's done.** Companies I've applied to are skipped for 90 days and dead ends forever, from a private `data/exclude.json`. Jobs already shown are remembered so tomorrow's list only has new ones.
5. **Deliver.** A digest email, and optionally an application email, but only when the post itself asks for applications by email, at most a few a day, never twice to the same company inside the cooldown, and only with `AUTO_SEND=1`. Forms behind CAPTCHAs and ATS logins are left for a human on purpose.

## Run it

```
npm install
cp .env.example .env            # nothing is sent until you fill SMTP and set AUTO_SEND=1
cp exclude.example.json data/exclude.json
npm run preview                 # fetch, filter, score; writes data/out/digest.html
npm test
```

Edit `src/profile.js` for your own skills, projects and links. Node 20 or newer, one dependency (nodemailer).

## Design notes

The pipeline is deliberately boring: plain functions, one JSON state file written atomically, no database, no queue. A cron job and a 600 line codebase are easy to trust and easy to change when a source changes its format, which happens about once a month.

Each source is wrapped so one failing feed logs a line and the run carries on. The state file prunes itself after 120 days.

The tests in `test/` cover the parts that decide what I see: location rules, application email detection, staleness, and the exclusion list. Most of the bugs I've hit came from a job board describing location in a way I hadn't seen before, so each fix there comes with a test.

## License

MIT
