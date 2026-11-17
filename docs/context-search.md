# Bounded repository content search

Starting in 0.12.20, the initial Relevant code search used by Relevant code, AI-assisted and AI Test invokes Git once for all its keywords. It counts matching lines separately for each word and retains at most 20 matching line numbers per file for excerpts. A line containing several words counts once for each; overlapping words remain independent. Existing IDF weighting, filename scoring, changed-file priority and snippet budgets stay the same. AI-assisted selection and AI Test's later research rounds are unchanged.

Git uses fixed-string, case-insensitive matching, explicit untracked-file/ignore behavior, sensitive pathspecs and the current exclusions. Filename and line-number fields use NUL separators; source lines are not retained after counting. Per-word classification uses escaped Unicode case-insensitive literal patterns. The corpus tests compare the installed Git's results for ASCII, Japanese, accented letters, Kelvin sign, long s, Greek final sigma and overlapping literals. This is UTF-8 text handling, not a promise about every legacy encoding or Unicode-table version across all Git builds. See the official [git-grep contract](https://git-scm.com/docs/git-grep) for fixed patterns, multiple patterns and NUL output.

The process uses fixed argument arrays, hides its window, disables filesystem monitor hooks and text conversion, and never invokes a shell or model. Privacy is checked before launching and after completion. Final selected source files still pass through the existing confined read and secret-redaction path; raw matching lines are not logged or sent as context directly.

## Failure and coverage limits

- No matches is a successful empty search. Missing Git/repository errors or unsupported control-character queries produce an unavailable-search note; they do not imply that the repository has no relevant content.
- The shared scan has a five-second deadline and 4,000,000-byte output cap. Only complete framed records count. Timeout, truncated or malformed output produces an incomplete-search note. Cancelling discards the search result and the gather's cancellation guard stops further work.
- This replaces up to eight separate four-megabyte count outputs plus a separate excerpt-position search. It bounds repeated work and buffered output, but full matching lines can reach the shared cap sooner in repositories with very long lines or frequent terms. Rankings then use partial evidence, explicitly disclosed in context notes. Naming files still improves filename ranking; this change does not claim a complete repository search at every size.
- Too many/long refused paths continue using the protected local fallback, with its existing file/byte/time bounds. Unknown, unchecked or sensitive files do not become eligible because the search changed.
- The parser supports unusual filename delimiters, including colon/tab/newline fixtures. Full file enumeration and explicit-path coverage are a separate tracked improvement (#21); this release does not claim those names work through every earlier enumeration step on every OS.

## Reproducible evidence

Run `node --expose-gc scripts/audit/context-search.mjs`. It creates 30,001 disposable files and compares three alternating runs of the prior production gather at `ef6f55c` with the new implementation. Every keyword count and emitted context item must match; no paid calls, owner project, UI or existing installation is used. [Raw timings, hashes and environment](audits/v1/context-search-measurements.json) are retained.

On the recorded Windows/Node 24.22.1/Git fixture, median search time fell from 2,942.491 ms to 651.543 ms (about 78%). Median complete Relevant code gathering fell from 5,441.310 ms to 2,370.800 ms (about 56%). That includes unchanged enumeration, filtering, project metadata and excerpt reads. These are tiny synthetic files, alternating warm-process runs and endpoint memory observations—not peak-memory, desktop rendering or universal latency guarantees.

Tests additionally exercise real Git exclusions/binary/no-match behavior, literal punctuation, Unicode counts/ranking, unusual framed names, partial output, timeout/cancel callbacks, privacy refusal and one-search integrated gathering. The existing Git filter-execution and real process-cancellation tests remain in the full suite.
