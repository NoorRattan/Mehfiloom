# Local performance and accessibility baseline

Measured on 2026-10-22 against the local optimized Next.js production build with Lighthouse 13.5.0, desktop preset, and Chromium Headless Shell 156.0.8078.4. Each route was measured once on the same machine. Lighthouse scores and timings vary between runs; this is a lab snapshot, not field Core Web Vitals.

| Route | Performance | Accessibility | Best practices | FCP | LCP | TBT | CLS | Speed Index |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 100 | 100 | 100 | 0.3 s | 0.8 s | 10 ms | 0 | 0.4 s |
| `/planner/wedding` | 100 | 100 | 100 | 0.3 s | 0.8 s | 60 ms | 0.012 | 0.5 s |
| `/wedding` | 99 | 100 | 100 | 0.3 s | 1.0 s | 30 ms | 0 | 0.7 s |
| `/birthday` | 100 | 100 | 100 | 0.3 s | 0.8 s | 10 ms | 0 | 0.4 s |
| `/community` | 100 | 100 | 100 | 0.3 s | 0.8 s | 0 ms | 0 | 0.3 s |

The automated accessibility and best-practice categories reported no failed audits on these routes. Playwright checks the core keyboard path, a 320 CSS-pixel viewport, and a 640 CSS-pixel width as the 200%-zoom equivalent of a 1280-pixel viewport. Letter and A4 PDFs of the synthetic example plan were rendered and visually reviewed; the review caught and fixed a printed skip link. A full manual keyboard session, screen-reader behavior, and actual browser zoom at 200% remain open release checks.

On this Windows runner, Lighthouse wrote each JSON report successfully, then reported `EPERM` while removing its temporary Chrome profile. The scores above were read from those completed report files. This cleanup issue did not change the site or its local browser data.
