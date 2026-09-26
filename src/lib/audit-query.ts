export function auditQuery(
  input: Record<string, string | string[] | undefined>,
  now = Date.now(),
) {
  const date = (value: unknown) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value;
  const startDay = date(input.from)
    ? String(input.from)
    : new Date(now - 7 * 86400000).toISOString().slice(0, 10);
  const endDay = date(input.to)
    ? String(input.to)
    : new Date(now).toISOString().slice(0, 10);
  const start = `${startDay}T00:00:00+05:30`;
  const end = `${endDay}T23:59:59.999+05:30`;
  const valid =
    Date.parse(start) <= Date.parse(end) &&
    Date.parse(end) - Date.parse(start) <= 90 * 86400000;
  const page = (value: unknown) =>
    typeof value === "string" && /^\d{1,4}$/.test(value)
      ? Math.min(Number(value), 2000)
      : 0;
  return {
    start,
    end,
    startDay,
    endDay,
    valid,
    page: page(input.page),
    memberPage: page(input.members),
  };
}
