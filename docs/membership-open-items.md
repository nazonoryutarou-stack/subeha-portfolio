# Membership open items

- [ ] Deploy `workers/membership-worker.js` to Cloudflare Workers
- [ ] Configure Cloudflare Access One-time PIN for `/login`
- [ ] Set Worker secrets / variables from `docs/membership-report-archive.md`
- [ ] Enable Stripe Customer Portal
- [ ] Fill `members/config.js` `apiBase` with deployed Worker origin
- [ ] Test paid signup -> OTP login -> report search -> report read -> portal
- [ ] Test cancellation / inactive subscription blocks access
- [ ] Merge only after the above passes
