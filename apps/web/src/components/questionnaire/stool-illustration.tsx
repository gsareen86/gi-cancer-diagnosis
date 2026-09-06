/** Schematic forms accompany the existing clinical text; they never replace option labels. */
export function StoolIllustration({ optionId }: { optionId: string }) {
  const type = Number(optionId.replace('type_', ''));
  return <svg viewBox="0 0 120 44" className="h-11 w-28 shrink-0 text-amber-800" aria-hidden="true" fill="currentColor">
    {type === 1 && <>{[20, 44, 68, 91].map((x, i) => <ellipse key={x} cx={x} cy={i % 2 ? 27 : 17} rx="8" ry="7" />)}</>}
    {type === 2 && <>{[23, 39, 55, 71, 87].map((x, i) => <ellipse key={x} cx={x} cy={i % 2 ? 25 : 21} rx="13" ry="12" />)}</>}
    {(type === 3 || type === 4) && <><path d="M20 17 C38 6 65 31 94 17 C106 13 110 30 97 33 C68 45 42 16 24 30 C12 36 9 23 20 17Z" />{type === 3 && <path d="M34 15 l-3 9 m23-3 l-4 10 m25-6 l3 10" stroke="#F8FAFC" strokeWidth="2" />}</>}
    {type === 5 && <>{[25, 56, 89].map((x) => <ellipse key={x} cx={x} cy="22" rx="13" ry="10" />)}</>}
    {type === 6 && <path d="M13 16 l11-7 7 8 14-8 10 13-7 12-15-3-10 6-8-10Z M68 12l17 4 13-4 6 14-13 9-17-5-11-8Z" />}
    {type === 7 && <><path d="M12 15q12-8 24 0t24 0t24 0t24 0M12 26q12-8 24 0t24 0t24 0t24 0M12 37q12-8 24 0t24 0t24 0t24 0" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></>}
  </svg>;
}
