# Positioning — what Scry actually is

> The short version: **Scry is the discernment gate between an AI agent and the
> third-party code it runs on your behalf.** The scanner is how it sees; the gate is how
> it acts; the ledger is how it remembers. Together they turn trust from an implicit,
> invisible act into a decision that is explicit, enforced, accountable, and revocable.

## The shift

AI is moving from models that **answer** to agents that **act**. An agent's reach is no
longer its weights — it's the tools, skills, and MCP servers it can invoke. That makes
third-party skills a **supply chain of executable capability**: code, written by strangers,
that runs on your machine with your agent's permissions, often pulled in with a single
line.

Every supply chain that mattered eventually needed a control point. This one doesn't have
one yet.

## The gap

Today, trusting a skill is **implicit, one-time, and invisible**:

- **No policy check.** Nothing is consulted at the moment a skill runs. Install equals
  execute.
- **No record.** There is no artifact that says "this is what we accepted, and why."
- **No drift detection.** A skill that was fine yesterday can change under you and still be
  trusted — trust-on-first-use, forever.
- **The judge can't be the agent.** Prompt injection lives _inside_ the skill's own text.
  Asking the model to decide whether a skill is safe is asking the thing being manipulated
  to referee its own manipulation. The arbiter has to be **external, deterministic, and
  LLM-free.** This is the structural reason Scry's core is what it is — not a stylistic
  one.

## What Scry is

A **discernment gate**: a small control loop with three parts.

| Part       | Role                 | In Scry                                                                                           |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------- |
| **Sensor** | Gather evidence      | Ten deterministic rules → a per-skill verdict (the Discernment Report)                            |
| **Gate**   | Enforce the decision | A PreToolUse hook denies a skill action with an unallowed critical (a policy-enforcement point)   |
| **Ledger** | Remember & account   | `.scry/lock.json`: content hashes, verdicts, and an allowlist of exceptions with who / when / why |

The essence isn't "it finds malware." Static analysis is shallow and Scry says so plainly
(see the README's Limitations). The essence is that the **trust decision now exists, is
enforced, and is accountable** — and that value holds even when a rule misses something.
The loop is the product; the rules are just its current senses.

## Lineage

Scry is not a new idea — it's an old, proven idea applied to a new surface. Every platform
that ran untrusted code grew the same primitive:

- **Package managers** → signing & provenance (npm provenance, Sigstore).
- **Mobile** → app review + a permission model.
- **Kubernetes** → admission controllers that validate workloads before they're admitted.
- **Browsers** → Content-Security-Policy gating what a page may execute and reach.

Each is a sensor + gate + record at an execution boundary. Scry is that boundary for agent
skills.

## Honest scope

So it doesn't get oversold:

- Scry is a **local, single-actor enforcement primitive** — the _control_ that governance
  is built on. It is **not** an enterprise governance platform: no org-wide policy
  distribution, no RBAC, no compliance reporting. Those could be built _on top_ of the
  lock and the report; they are not in the box.
- Detection is **deterministic but shallow** — precision over recall, static only. It
  reduces the blast radius of running untrusted skills; it does not remove the need to read
  the code you run.
- A `CLEAN` verdict means _"nothing concealed surfaced by the deterministic checks,"_ not
  _"safe."_

## One sentence

If someone asks what Scry is: **the discernment gate for agent skills — it makes the trust
you place in third-party code explicit, enforced, accountable, and revocable.**

---

_Built for inheritance, not hype._
