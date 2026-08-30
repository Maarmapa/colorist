# Demo video — shot list

**Target 2:40. Hard limit 3:00 — judges are not required to watch past it.**
Public on YouTube, with audio. Narration below is what gets said; the screen
column is what is happening while it is said.

Recording rules, learned the hard way:
- **Do not cut during an agent call.** The pause while the model thinks is the
  proof it is live. Cutting there reads as editing.
- **Do not stage the stock.** If a tone sells out between rehearsal and take,
  even better — that is the whole point.
- Run `scripts/rehearse.mjs` immediately before recording. It checks the four
  conditions the money shot depends on and names the one that fails.
- Browser: ChatGPT's in-app browser (native WebMCP), or Chrome with
  `chrome://flags/#enable-webmcp-testing`. Full screen, no bookmarks bar.

---

## 0:00–0:18 · The claim

**Screen** — Split. Left: the live page, 1,677 swatches painted, the stock line
reading *live stock · N tones available right now*. Right: the agent, empty.
Cursor still.

> "This is a real art supply shop in Santiago, Chile. Seventeen colour cards,
> one thousand six hundred and twenty-five tones, each painted with the hex
> value from the shop's own card. The stock number is live. Nothing here is a
> mock."

---

## 0:18–0:40 · The asymmetry

**Screen** — Type in the agent: *"I want to paint these five colours. What do I
actually need to buy?"* — then the palette chips appear as `set_targets` runs.

> "The model reasons about colour and has never seen one. This page paints
> colour and cannot reason. Watch what they do with the same object."

---

## 0:40–1:05 · What is missing, and what it costs

**Screen** — `analyze_gaps` then `plan_purchase` run. The plan appears: four
markers, the total in Chilean pesos, and each step showing how much perceptual
distance it buys.

> "Four markers, seventeen thousand two hundred pesos. Each one reports how much
> perceptual distance it buys, computed here with CIEDE2000 against the tones I
> already own — no request went out for any of that."

---

## 1:05–1:25 · 🔴 The line no shop says

**Screen** — Zoom on the step marked not worth it: *E09 — only buys ΔE 0.2*.
Hold on it.

> "And then it stops. The next marker after those four buys two tenths of a
> perceptual unit — a difference no eye can see. The shop tells me not to buy
> it. That sentence is in the plan because the maths put it there, not because
> someone wrote a nice line."

---

## 1:25–1:50 · 🔴 THE MOMENT — one take, no cut

**Screen** — Click *"I already have these"*. In the SAME frame, without cutting:
the gap count goes to zero, and on the right panel `prepare_order` strikes
through in red with the reason printed under it — *no gap: their kit already
covers these targets*. Slow zoom on the panel.

> "Now I tell it I already own those four. Watch the right-hand panel — not the
> answer, the panel. The tool that builds a cart just stopped existing. Not
> disabled. Not refused. Unregistered, through the abort signal of registerTool,
> and gone from document dot modelContext dot getTools."

**Beat. Let the silence sit for one second.**

> "A remote server can answer badly from a cart tool. It cannot *not have* one —
> because it does not know what is in my kit, and it does not know because my
> kit never left this tab."

---

## 1:50–2:10 · It refuses when refusing is right

**Screen** — `set_surface` with `wall`. The usable count drops from 1,366 to
252, and the excluded cards appear with their reasons.

> "I tell it I am painting a wall. Thirteen hundred usable tones collapse to two
> hundred and fifty-two. Every Copic is gone — alcohol ink is transparent, it
> does not cover, and it fades outdoors. The colour could match perfectly and
> the answer is still no."

---

## 2:10–2:30 · Borrowing an eye

**Screen** — `ask_the_eye` fires. Two swatches fill the screen. The call is
visibly waiting. Click one. The agent receives the choice.

> "And when the numbers call it a tie, it asks. This call does not return until
> a person looks at two colours and picks one. No backend puts rectangles on
> someone's screen and waits for a finger."

---

## 2:30–2:40 · Close

**Screen** — The cart on screen, total in pesos, the button unclicked. Fade.

> "The list is ready. The button is mine — no tool on this page charges anyone.
> Colorist: a shop that runs out of things to sell you."

**Last frame, text only, no voice:**

> **The restriction is not in the prompt. It is in the shape of the API.**

---

## If it runs long

Cut in this order, and no further:

1. **2:10–2:30, `ask_the_eye`.** Painful, but the disappearing tool is the
   thesis and the substrate refusal is the trust.
2. **1:50–2:10, the wall.** Only if still over.
3. **Never cut 1:25–1:50.** That is the submission.
