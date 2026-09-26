// Print an isolated copy so a later released plan cannot hide the preliminary assessment.
export function printAssessment(element: HTMLElement | null) {
  if (!element) return;
  const copy = element.cloneNode(true) as HTMLElement;
  copy.classList.add("assessment-print-copy");
  copy.querySelectorAll(".hypothesis-open, .source-chip").forEach((item) => {
    if (item.tagName !== "BUTTON") return;
    const text = document.createElement("div");
    text.className = item.className;
    text.append(...Array.from(item.childNodes));
    item.replaceWith(text);
  });
  copy
    .querySelectorAll("button, dialog, .screen-only")
    .forEach((item) => item.remove());
  document.body.append(copy);
  try {
    window.print();
  } finally {
    copy.remove();
  }
}
