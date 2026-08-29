# Colorist

**A shop that runs out of things to sell you.**

Ask any store what you need to paint a palette and it says *"buy these eight"* — it
knows its catalogue and nothing about you. This page also knows **what you already
own**, so it says *"you have five, you need three."* And when you own all eight, it
has nothing to sell you. Not as a message. Literally: the tool that puts things in
a cart **stops existing** for the agent.

```
your kit is empty        →  document.modelContext.getTools() includes prepare_order
your kit covers the job  →  prepare_order is gone
```

That is the whole idea, and it is the one thing a remote MCP server cannot do. A
server can answer badly from a cart tool. It cannot *not have* one — because it does
not know what is in your kit, and it does not know because your kit never leaves this
tab.

---

## Try it

Open the live page in **ChatGPT's in-app browser** (WebMCP on by default) or **Chrome
149+** with `chrome://flags/#enable-webmcp-testing`. Then ask your agent:

> *"I want to paint these five colours. What do I actually need to buy?"*

Load the sample kit and ask again. Watch the right-hand panel.

---

## Why this needs WebMCP and not a server

Three things here only exist inside the tab:

| | why a server cannot do it |
|---|---|
| **Your kit** | It is in `localStorage`, with no account and no upload. No server knows it exists. Loading it makes **zero** network requests — check the network panel. |
| **The tool surface** | `prepare_order` is registered and unregistered from the live gap calculation, through the `{signal}` of `registerTool`. The agent's *capabilities* change because your situation changed. |
| **`ask_the_eye`** | The call does not resolve until a human looks at two swatches on screen and picks one. No backend puts rectangles on someone's screen and waits for a finger. |

The model reasons about colour and has never seen one. The page paints 1,625 real
tones and cannot reason. Each lends the other the organ it is missing.

---

## The data is real

Everything comes from a working art supply shop in Santiago, Chile, through its
**public, unauthenticated MCP endpoint**. No credentials exist anywhere in this
repository, and if this project ever needed one, something would have been designed
wrong.

```
Colour cards in the shop's catalogue   62
Cards with per-tone hex values         17   ← the other 45 are deliberately absent
Tones shipped                       1,677
Tones with a verified hex           1,625

Application code                 11.4 KB gzipped
Colour data                        14 KB gzipped, 17 lazy chunks
WebMCP polyfill                    71 KB gzipped — and never downloaded
                                        in ChatGPT's browser, which has the API
Network on cold boot               17 requests (live stock only, one per card)
Network per tool call                  0
```

Measured from `npm run build`, not estimated. Every number above is checkable.

Hex values are baked into the repo because they never change. **Stock is not baked** —
a frozen stock number would be a lie. It is fetched live and, when it cannot be
reached, the page says so and refuses to call anything purchasable.

The gaps are real too, and they are the interesting part: the entire Molotow ONE4ALL
range — 188 tones — is sold out in Chile right now, and 126 of 224 Molotow Premium
sprays are gone.

---

## Four things it will not do

**It will not invent a colour.** 52 tones ship with `hex: null`. They are drawn with a
diagonal hatch labelled `unmapped` and are never matched against, never painted, never
recommended. A colour the manufacturer never made is worse than no answer.

**It will not claim a tone is available without checking.** `available` is `true` only
when live stock confirmed it. Unknown stays `null`, and `null` is never recommended.
When the shop is unreachable, `plan_purchase` returns `stock_unverified` — because
*"nothing to buy"* and *"I could not check"* are opposite situations and telling a
person the first when the truth is the second is the worst thing this app could do.

**It will not sell you the wrong medium.** Surface filtering runs *before* colour, never
after. An alcohol marker is never offered for a wall even at ΔE 0.8 — alcohol ink is
transparent, does not cover, and fades outdoors. Choose `wall` and 1,366 usable tones
drop to 252, each exclusion carrying its physical reason. When nothing suits a surface,
`no_honest_match` says so instead of offering the closest colour on the wrong material.

**It will not buy anything.** No tool on this page charges, orders, or submits.
`prepare_order` fills a cart and shows it. The click is yours.

---

## Design decisions a reviewer might want to check

**`execute` returns plain values.** The spec defines
`callback ToolExecuteCallback = Promise<any>` and the browser JSON-serialises whatever
you return — there is no `ModelContextToolResult`. Wrapping in
`{content:[{type:'text'}]}` is MCP's *wire* format and a convention of `@mcp-b/global`;
forwarding it from a page hands the agent the transport envelope instead of the answer.
The only place that shape exists here is where the remote MCP's reply is *unwrapped*.

**No tool ever throws.** The spec discards the rejection reason, so a `throw` reaches
the model as "something failed" and it retries blind. Every failure is a returned value:
`{ok:false, error, message, hint}`. The `hint` is the difference between an agent that
corrects itself and one that insists.

**Both annotations are always declared,** including when the value is the default.
`readOnlyHint: false` written on purpose reads as intent; omitted reads as an oversight.
`untrustedContentHint: true` goes on everything carrying manufacturer catalogue text.

**`document.modelContext` first.** The getter moved from `Navigator` to `Document` in
the spec, and Chrome 152 removed the alias. `navigator.modelContext` is accepted as a
deprecated fallback, never as the preference. Native always wins: the polyfill loads
only when the browser has no API, so in ChatGPT's in-app browser this page downloads
zero extra bytes.

**Colour maths is local and verified.** CIEDE2000 is implemented here, not called out
to, and it passes all 34 reference pairs from Sharma, Wu & Dalal (2005) to 1e-4 — that
suite exists because the formula has three places where a reasonable implementation is
*almost* right, and almost means recommending the wrong marker. See
`tests/ciede2000.test.mjs`.

**One capability firewall, server-side.** `api/catalog.js` is the only route to the
shop. It allows exactly `tools/list` and `tools/call` over five read-only catalogue
tools; `create_checkout` and the email-capture tool are blocked **there**, not by the
client's good behaviour, and it never forwards an `Authorization` header, so the shop's
sensitive tools are unreachable even by accident. Same file runs in dev and in
production — a security control you test but do not deploy is not a control.

---

## Run it

```bash
npm install
npm run dev      # http://localhost:5180
npm test         # 44 tests
npm run bake     # regenerate data/cards/ from the shop's public endpoint
```

No environment variables. No `.env`. No account. No backend beyond the firewall above.

---

## Layout

```
api/catalog.js        the capability firewall (the only network boundary)
src/color/            CIEDE2000, sRGB→Lab, the gap engine, substrate rules
src/webmcp/           tool registration, the ok/fail/safeExecute contract
src/state/drawer.ts   your kit — the reason this needs WebMCP
src/ui/               the swatch grid, and ask_the_eye
data/cards/           1,677 baked tones + PROVENANCE.md
tests/                44 tests, including what the firewall must NOT allow
```

## Prior work and new work

The shop, its catalogue and its remote MCP server existed before this hackathon. **Every
line in this repository was written during the submission period**, in a repository
created from scratch on 29 August 2026 — see the commit history. The shop's endpoint is
used here the way any third party could use it: publicly, without credentials.

## Licence

MIT — see [LICENSE](LICENSE).
