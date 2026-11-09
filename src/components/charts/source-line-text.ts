const OSLO_TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Oslo",
  dateStyle: "medium",
  timeStyle: "short",
});

export function staleLabel(staleSince: string, sourceName: string): string {
  return `${sourceName} was unreachable: cached copy from ${OSLO_TIME.format(new Date(staleSince))} (Oslo time)`;
}
