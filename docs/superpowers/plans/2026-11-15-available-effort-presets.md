# Available effort presets

## Scope and evidence

- The owner reported Medium and High recommendations were unavailable after the Haiku reasoning fix. Raw session and normalized client catalogs both omitted GPT-6.1 Sol and Claude Opus 5.5 before plugin filtering. Both included GPT-6.1 Terra and Claude Sonnet 5.5 with High and Medium reasoning respectively.
- Isolated installed-runtime sessions accepted each replacement and returned the exact requested model and reasoning from `getCurrent`. Zero prompts were sent; no paid inference or desktop/browser control. Temporary probe directories were cleaned.
- The owner explicitly approved Medium = GPT-6.1 Terra / High and High = Claude Sonnet 5.5 / Medium. Low remains Claude Haiku 5.5 / highest supported. Explicit custom assignments and reasoning must not be overwritten.
- GitHub's [model-access guidance](https://docs.github.com/en/copilot/how-tos/copilot-on-github/set-up-copilot/configure-access-to-ai-models) identifies plan, client and organization policy as access factors. Catalog omission alone does not identify the account's plan or restriction.

## Work and verification

- [x] Reproduce the unavailable defaults using recorded catalog names and IDs in resolver and worker tests.
- [x] Update the shared presets, preview fixtures and current documentation. Preserve historical release notes and explicitly selected Sol/Opus models.
- [x] Distinguish missing recommendations from ambiguous matches in structured errors and keep refresh guidance accurate.
- [x] Rebuild version 0.10.2, run typecheck/full tests/package checks, and obtain a fresh review.
- Delivery: commit and push verified work to main without a tag or release; report the resulting commit and push status in the completion message.

## Final verification

- Typecheck, production build and package checks passed. Final post-build suite: 324 passed, 0 failed, 0 skipped.
- The updated production catalog adapter and shared resolver selected all three presets from the live installed runtime. Isolated sessions returned Haiku 5.5 / Max, GPT-6.1 Terra / High and Sonnet 5.5 / Medium exactly. No prompt was sent.
- A fresh independent review found no blocking issues; its 22 focused tests passed.
- Desktop visual checks and a real account-backed enhancement remain for the owner after updating. No desktop/browser control or paid inference was performed.
