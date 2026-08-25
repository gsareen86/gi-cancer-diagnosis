/**
 * The text a person can actually read on the page.
 *
 * `textContent('body')` returns the contents of every node, including `<script>` — and Next inlines
 * the whole message catalogue into the document. So a substring check against it matched the
 * English translation of the key rather than anything rendered, and passed just as happily on a
 * blank screen. Several walkthroughs asserted that way and were reporting nothing at all.
 *
 * `innerText` is computed from layout, so it sees only what was drawn.
 */
export async function visibleText(page) {
  return page.evaluate(() => document.body.innerText);
}

/**
 * Does the visible text contain this phrase?
 *
 * Case-insensitive on purpose. `innerText` reflects CSS, and several headings are drawn through
 * `text-transform: uppercase` — so the string in the message catalogue and the string on the screen
 * differ in case even though a reader sees the same words. Matching exactly would fail on the
 * headings that are most certainly there.
 */
export function has(text, phrase) {
  return text.toLowerCase().includes(phrase.toLowerCase());
}

/**
 * Everything the browser was sent — markup, inlined payloads and all.
 *
 * The right source for a leak check, and only for that: content that reached the patient's device
 * has leaked whether or not an element ever drew it. Never use it to assert something is *shown*,
 * because the inlined message catalogue alone will match almost any phrase.
 */
export async function deliveredText(page) {
  return page.content();
}
