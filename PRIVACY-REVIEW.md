# Privacy review

Reviewed on 4 November 2026, against the live deployment. The notice that covers this product's
demonstration is formancy.ai's [privacy notice](https://formancy.ai/privacy/), and this file is what
it rests on for Formancy Report.

- **Where it runs.** At [https://formancy.ai/report/](https://formancy.ai/report/), served by the
  Worker `formancy-report-studio`, which serves files and runs no code of its own:
  `apps/studio/wrangler.json` names assets and no script.
- **Cookies, storage and tracking.** Read from the live demonstration: no response sets a cookie,
  and its script uses no browser storage and holds no analytics, Zaraz or Turnstile script.
- **What a visitor types.** It is sent nowhere. The page's code requests only its own files, and
  `apps/studio/scripts/browser-test.mjs` holds that the Studio fetches nothing, and hints no
  connection, outside its own build. Unlike the demonstrations of Data and Health, it is served with
  no content security policy, read from its response the same day.
- **Cloudflare.** It delivers the demonstration as it delivers the rest of formancy.ai; the privacy
  notice says what it processes and names the safeguards it states for transfers.
- **Consent.** Nothing optional is set or read, so there is nothing to ask consent for.

Nothing re-reads the live deployment: read it again when the demonstration's deployment or
Cloudflare's settings for formancy.ai change, and date what was read.
