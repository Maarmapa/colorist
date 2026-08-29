# Devpost submission — Colorist

Draft answers for the four questions the form asks. Kept in the repo so the
claims can be checked against the code that makes them.

---

## Tagline

**The color you want, and the closest one you can actually buy today.**

---

## Why this use case is a strong fit for WebMCP

Because the decisive fact lives in the browser and nowhere else.

An art supply shop knows its catalogue. It does not know what is already in your
kit — the markers on your desk. That single missing fact is what separates
*"buy these eight"* from *"you have five, you need three"*, and no server can
close it without an account, a login, and you uploading your possessions to a
company.

WebMCP closes it without any of that. The kit stays in `localStorage`, the
comparison runs in the tab, and the agent gets the answer without the data ever
moving.

Then it goes one step further, and this is the part that only this API allows.
Because the page computes the gap locally, it can decide **which tools exist**.
When your kit already covers the palette, `prepare_order` is not disabled and
does not return a polite refusal — it is unregistered, through the `{signal}` of
`registerTool`, and disappears from `document.modelContext.getTools()`.

A remote MCP server can answer badly from a cart tool. It cannot *not have* one.
That asymmetry is the whole submission:

> **The restriction is not in the prompt. It is in the shape of the API.**

---

## How it creates a better user experience

Every shop is structurally incapable of telling you not to buy. This one does it
by construction, and in three ways you can verify on screen.

**It counts what you own first.** The plan optimises the *worst* colour in your
palette, not the average — an average hides the one tone you cannot make at all,
and that is the tone that ruins the piece. Each step reports what it costs in
CLP and how much perceptual distance it buys, so the fourth marker showing
*"+$4,300 → buys ΔE 0.2"* is visible rather than quietly sold to you.

**It refuses when refusing is correct.** Physical filtering runs before colour,
never after. Choose `wall` and 1,366 usable tones collapse to 252, with every
exclusion carrying its reason — alcohol ink is transparent, does not cover, and
fades outdoors. The colour may match at ΔE 0.8 and the answer is still no.

**It asks you when the numbers stop deciding.** Below about ΔE 2 the difference
is not reliably visible, so `ask_the_eye` puts the candidates full-size on screen
and the call does not resolve until a human picks. The model has never seen a
colour; this is how it borrows your eyes.

And it never claims what it did not check: 52 tones ship with no hex value and
are drawn hatched and labelled `unmapped`, and when live stock is unreachable the
tools return `stock_unverified` instead of the far more damaging *"you already
have everything."*

---

## What people and agents can do together that was difficult or impossible before

**A shop that runs out of things to sell you.** Not as a slogan — as an API
surface that shrinks. Fill your kit until the palette is covered and watch the
tool that builds carts vanish from the agent's list, with the reason printed on
screen. Before WebMCP, "the agent cannot sell you this" could only ever be a
sentence in a prompt, and prompts get ignored by a tired model. A tool that does
not exist gets called by nobody.

**A blind expert and a screen that cannot think, working the same object.** The
model reasons about colour and has genuinely never seen one. The page paints
1,625 real tones with the manufacturer's own values and computes CIEDE2000 in the
same frame, and cannot reason about any of it. Each lends the other the organ it
is missing, on one canvas, in real time.

**A recommendation that can say "there is no honest answer."** Because the page
knows the physical medium of every tone — solvent spray, alcohol ink, water-based
acrylic — and the surface you are painting, it can distinguish *"here is
something close"* from *"nothing here is made for this, and here is why."* That
sentence is what makes the other answers trustworthy.

**Numbers about your own things, without giving them away.** The agent reasons
across your kit and the shop's live stock at once, and the network panel shows
zero requests during the part about you.

---

## How WebMCP was implemented

Nine tools on `document.modelContext`, registered under an `AbortController` —
the canonical surface since the getter moved from `Navigator` to `Document`, with
`navigator.modelContext` accepted only as a deprecated fallback. Native always
wins: the polyfill loads solely when the browser has no API, so in ChatGPT's
in-app browser the page downloads zero extra bytes.

**Six are always present** — reading the workbench, setting targets, analysing
gaps, planning a purchase, declaring the surface, and updating the kit.

**One is conditional.** `prepare_order` lives in its own `AbortController`,
registered when the local gap calculation finds something worth buying and
aborted the moment it does not. That controller is the mechanism of the whole
project.

**One waits for a human.** `ask_the_eye` returns a promise that resolves on a
click, an `Escape`, a dismissal, or a 90-second timeout — and the `{signal}` from
`execute`'s second argument cancels it cleanly when the agent gives up.

Details that matter to anyone reading the source:

- **`execute` returns plain values.** The spec is `Promise<any>` and the browser
  JSON-serialises the result; there is no `ModelContextToolResult`. The
  `{content:[{type:'text'}]}` shape is MCP's *wire* format, and forwarding it from
  a page hands the agent the transport envelope instead of the answer. It appears
  exactly once here: where the remote MCP's reply is unwrapped.
- **No tool ever throws.** The spec discards the rejection reason, so a throw
  reaches the model as "something failed" and it retries blind. Every failure is
  a returned `{ok:false, error, message, hint}`.
- **Both annotations are always declared,** including at their default values —
  `readOnlyHint: false` written deliberately reads as intent, omitted reads as an
  oversight — and `untrustedContentHint: true` marks everything carrying
  manufacturer catalogue text.
- **`getTools()` is rendered as UI.** The panel on the right shows the agent's
  live surface, so the moment a tool disappears is visible without opening
  DevTools.
- **One capability firewall,** server-side: five read-only catalogue tools pass,
  `create_checkout` and email capture are blocked *there* rather than by the
  client's good behaviour, and no `Authorization` header is ever forwarded. The
  same file runs in development and production.

Colour maths is local and verified: CIEDE2000 implemented here, passing all 34
reference pairs from Sharma, Wu & Dalal (2005) to 1e-4. 44 tests, including ones
that assert what the firewall must *not* allow.

---

## Prior work and new work

The art supply shop, its product catalogue and its remote MCP server all existed
before this hackathon, and are the *context* of the problem rather than the work
submitted.

**Every line in this repository was written during the submission period.** The
repository was created from scratch on 29 August 2026 — four days after the
period opened on 25 August — and the commit history shows the whole build, from
the first commit (a deny-all `.gitignore` and the licence) forward. Nothing was
copied in from an existing project.

The shop's MCP endpoint is used here exactly the way any third party could use
it: publicly, over HTTPS, without credentials. There is no `.env` in this
repository and no environment variable anywhere in the code.
