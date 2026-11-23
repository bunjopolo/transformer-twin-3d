# Free Netlify hosting

Live URL: https://q7m4-v9k2-r6p8.netlify.app

Netlify site ID: `4af64ac5-526d-4b52-973f-c2f71d3381ce`.
The local `.netlify/state.json` links this checkout to that site. Keep updates on
this site to preserve the shared URL. Deployment verified on 17 November 2026:
production and immutable deployment URLs return 401 without credentials (and
with incorrect credentials), 200 with the configured credentials, and 401 again
after authenticated requests. HTTP redirects to HTTPS. Browser login and the
rendered 3D cutaway were verified. The account is on `credit-free`, with automatic
top-ups disabled.

The existing `dist/` app is protected by `netlify/edge-functions/password-gate.js`.
Every page and asset requires HTTP Basic authentication, including direct model
and JavaScript URLs. The browser displays its standard username/password dialog.

- Username: `viewer` by default; override with `SITE_USERNAME`.
- Set `SITE_PASSWORD` using Netlify's environment variables, with the Functions
  scope included.
- Never put credentials in `dist/`, `netlify.toml`, Git, or a shared URL.
- Deploy with Netlify CLI from this directory so it bundles the Edge Function.
  A drag-and-drop upload of `dist/` alone does **not** include the password gate.
- Set the environment variables before deploying. Missing or empty passwords
  return HTTP 503 and keep the app inaccessible.
- Use the Free plan and its included `netlify.app` address. No paid password
  protection feature or custom domain is needed. Free-plan usage is capped;
  hitting the allowance can pause the site until the next billing cycle.
- Password changes require a new deployment. Older immutable deployment URLs
  retain their original environment values; remove obsolete deployments when
  revoking previously shared credentials.
- Sensor data imports remain local to each visitor's browser. Maintenance folder
  uploads use shared Netlify Blobs storage through the protected maintenance function.

Before publication, run `node test-netlify-auth.mjs` and the existing regression
suites. On the hosted production **and immutable deployment** URLs, verify that
`/`, `/app.js`, and `/models/transformer.glb` return 401 without credentials and
200 with valid credentials. Recheck unauthenticated access after an authenticated
request to catch cache leakage. Verify the 3D view in a browser after login.

Netlify references:
- https://docs.netlify.com/build/edge-functions/environment-variables/
- https://docs.netlify.com/build/edge-functions/optional-configuration/
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/
