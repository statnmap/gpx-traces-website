# Standard: code changes, fixes and new features

*For humans and AI agents.*

*Updated on 2026-11-21*

*French version: [modifications-du-code.md](https://github.com/statnmap/blog_tips/blob/master/2026-11-21-training-an-ai-like-a-junior-with-a-lean-standard/modifications-du-code.md).*

## Intention

*The intention behind the move, to adapt without losing sight of the end result*

- Every change leaves the code tested, consistent and documented, without regression or technical debt.
- A human or an AI agent following this standard delivers a change that someone else can pick up without surprise.

## Typical mistakes

*to avoid repeating them*

- 🛑 Fixing or changing a single file when other similar files have the same problem.
- 🛑 Testing only the nominal case.
- 🛑 Leaving debug code or temporary files in the commit.
- 🛑 Ignoring a failure of the tests or the linter.
- 🛑 Not updating the documentation: the behaviour changes, the docs do not say so.

## Key points

*to know whether the piece is OK or not OK*

### ✅ Files similar to the modified file were checked for the same problem

*The same defect or the same need often exists elsewhere in the code; fixing it only once leaves inconsistencies.*

- ✅ "Checked that all `*.service.ts` files handle errors the same way."
- ❌ "I only fixed this file."

### ✅ Related files (configuration, tests, CI, documentation) are updated, or declared not concerned

*A new feature that forgets its configuration or its CI breaks at deployment, not during development.*

- ✅ "GitHub Actions workflow updated for the new `API_KEY` environment variable."
- ❌ "I assumed the CI would pass."

### ✅ Tests cover the nominal case and at least three edge cases: empty input, `null` value, external call error

*Production defects rarely come from the nominal case.*

- ✅ "Tests added for `calculateTotal()`: empty array, `null` value, failing API."
- ❌ "Only tested the nominal case."

### ✅ `npm test` and `npm run lint` pass without error

*A failure ignored today becomes tomorrow's debt, and tomorrow's red CI.*

- ✅ Both commands end with exit code 0.
- ❌ "The linter reports two errors, I will fix them later."

### ✅ The commit contains no debug code and no temporary file

*A clean repository avoids confusing the next reader.*

- ✅ No `console.log` added, no `*.backup`, `*.old` or `debug.log` file.
- ❌ "Committed `temp_fix.js` by mistake."

### ✅ Dependencies are up to date (`npm update`) and each version change is justified

*An old dependency brings known vulnerabilities; an unreviewed version bump brings regressions.*

- ✅ "`axios` updated to fix a security vulnerability (CVE-2023-1234)."
- ✅ Targeted fix (one vulnerability, a security `overrides`): `npm install --package-lock-only` regenerates `package-lock.json` for that fix only, without a global `npm update`.
- ❌ "I kept the old version of `axios` for no reason."
- ❌ `npm update` run to fix a single vulnerability: unrelated dependencies change in the same commit.

### ✅ The documentation describes the new behaviour (README, comments, Swagger)

*The documentation is the knowledge base of the team and of the agent that will pick up the code.*

- ✅ "`README.md` updated with the usage of the new `/new-feature` endpoint."
- ❌ "The code is self-documenting."

### ✅ Generated files are ignored by git

*A committed generated file creates conflicts and hides the real changes.*

- ✅ `dist/` is in `.gitignore`.
- ❌ The `dist/` folder appears in the commit.

## Visual

*to make it easier to remember*

**Pre-commit grid, displayed by the AI agent**

- [ ] Similar files checked
- [ ] Related files (config, tests, CI, docs) updated or not concerned
- [ ] Tests: nominal + empty + `null` + external error
- [ ] `npm test` and `npm run lint`: exit code 0
- [ ] No debug, no temporary file
- [ ] Dependencies up to date, changes justified
- [ ] Documentation up to date
- [ ] Generated files ignored

A test failure blocks the commit: the agent says so and proposes the fix before going further.
