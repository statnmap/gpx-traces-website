# Standard: analysing a technical defect and fixing it

*For humans and AI agents: bugs, CI failures, broken pipelines.*

*Updated on 2026-11-19*

*French version: [analyse-d-un-defaut-technique.md](https://github.com/statnmap/blog_tips/blob/master/2026-11-21-training-an-ai-like-a-junior-with-a-lean-standard/analyse-d-un-defaut-technique.md).*

## Intention

*The intention behind the move, to adapt without losing sight of the end result*

- Fix a defect at its cause, not at its symptom, so that it does not come back.
- A human or an AI agent following this standard reaches the same analysis and the same fix.

## Typical mistakes

*to avoid repeating them*

- 🛑 Fixing the visible symptom (the red test, the error message) without looking for why it appears.
- 🛑 Fixing one file without looking at the files that call it: the CI then fails because another module depended on the modified code.
- 🛑 Validating a fix locally only: it works on the workstation, then fails in CI for lack of access rights to a production API.
- 🛑 Delivering a fix without a test that reproduces the defect.
- 🛑 Proposing a patch right away, without re-reading the standard: "it was written that I had to do this, but I just didn't follow the standard this time".

## Key points

*to know whether the piece is OK or not OK*

### ✅ The root cause is written in one sentence that names the file, function or data at fault

*A fix without a named cause often hides the real problem, which comes out elsewhere.*

- ✅ "The error comes from an unhandled `null` value in the response of the `getUser()` API."
- ❌ "I fixed the bug."

### ✅ At least one other explanation was considered, then ruled out with its reason

*The first plausible hypothesis is not always the right one; ruling it out with a fact avoids fixing the wrong place.*

- ✅ "Network lead ruled out: the error reproduces offline, with the recorded API response."
- ❌ The analysis mentions only one lead.

### ✅ A test reproduces the defect: it fails before the fix and passes after

*It is the proof that the cause found is the right one, and the guard against the defect coming back.*

- ✅ "Added `getUser() handles a null response`: red on `main`, green on the branch."
- ❌ "I tested manually, it seems to work."

### ✅ The files that call the modified code are listed, and their compatibility is checked

*A local fix can break another module that depended on the old behaviour.*

- ✅ "`getUser()` is called in `profile.js` and `admin.js`: both handle the new `null` return."
- ❌ The CI fails after the fix because another module depended on the modified code.

### ✅ The fix is checked in CI or production conditions, not only locally

*Access rights, environment variables and data differ from one environment to another.*

- ✅ "The API call uses the production service account: rights checked and noted in the ticket."
- ❌ The fix works locally, then fails in CI for lack of permission on the API.

### ✅ The security implications are written down, even to say there are none

*A fix can open a vulnerability (injection, data leak) that the functional test does not see.*

- ✅ "The new query uses prepared statements: no SQL injection possible."
- ❌ "I added a new endpoint." (with no word on security)

### ✅ The answer to "what would have shown this defect earlier?" is written down, with the resulting action

*This is the continuous improvement loop: each defect strengthens a test, the CI or this standard.*

- ✅ "Added to the standard: for any fix that calls an API, check the rights in production."
- ❌ The defect is fixed and nothing else changes.

### ✅ The change itself follows the ["Code changes"](code-changes.md) standard

*So that a fix is treated like any other change: tests, cleanup, documentation.*

## Visual

*to make it easier to remember*

**Grid the AI agent displays at the top of each analysis answer**

```markdown
Defect analysis:
- ✅ Root cause: unhandled null value in getUser()
- ✅ Other lead ruled out: network (reproduced offline)
- ⚠️ Reproduction test: missing
- ✅ Callers checked: profile.js, admin.js
- ❌ Checked in CI conditions: no → to do before concluding
- ✅ Security: no implication
- ✅ Earlier: point added to the standard
```

A ❌ or ⚠️ point is stated as is: the agent does not conclude that it is fixed while any remain.
