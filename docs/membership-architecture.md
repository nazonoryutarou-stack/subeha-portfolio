# Membership architecture summary

Flow:

1. Visitor opens public `members/` UI.
2. Signup uses Stripe Payment Link for monthly `常連` subscription.
3. Login goes through Cloudflare Access One-time PIN.
4. Worker verifies Access JWT, finds Stripe customer by email, and confirms active subscription for `prod_V7qF7gyIfxRcAg`.
5. Worker issues short-lived signed member session.
6. Search requests read `reports/index.json` from private transcript repo.
7. Report requests read only the requested `reports/<episode>.md` from private transcript repo.
8. Customer Portal handles payment method updates and cancellation.

No paid report body is stored in the public repository.
