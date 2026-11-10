import certificationsData from "@content/about/certifications.json";
import educationData from "@content/about/education.json";
import lifeData from "@content/about/life.json";
import volunteeringData from "@content/about/volunteering.json";
import workData from "@content/about/work.json";

export type TimelineCategory = "life" | "education" | "work" | "volunteer" | "certification";

export interface TimelineRole {
  id: string;
  title: string;
  description: string;
  start: Date;
  end: Date | null;
}

export interface TimelineEvent {
  id: string;
  category: TimelineCategory;
  title: string;
  subtitle: string;
  description: string;
  url?: string;
  image?: string;
  start: Date;
  end: Date | null;
  isPointInTime: boolean;
  roles?: TimelineRole[];
}

type WithImage = { image?: string };

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_MONTH = MS_PER_DAY * 30.44;

function getImagePath(path: string | undefined): string | undefined {
  if (!path) return undefined;
  if (path.startsWith("/src/assets/icons/")) return path;
  return `/src/assets/icons/logos/${path}`;
}

function toDate(value: string | null | undefined) {
  return value ? new Date(value) : null;
}

function groupRoles(
  category: "work" | "volunteer",
  index: number,
  organisation: string,
  url: string | undefined,
  image: string | undefined,
  roles: { name: string; description?: string; start: string; end?: string | null }[],
): TimelineEvent {
  const id = `${category}-${index}`;
  const timelineRoles: TimelineRole[] = roles.map((role, roleIndex) => ({
    id: `${id}-${roleIndex}`,
    title: role.name,
    description: role.description ?? "",
    start: new Date(role.start),
    end: toDate(role.end),
  }));
  timelineRoles.sort((a, b) => {
    if ((a.end === null) !== (b.end === null)) return a.end === null ? -1 : 1;
    return (b.end ?? b.start).getTime() - (a.end ?? a.start).getTime();
  });

  return {
    id,
    category,
    title: organisation,
    subtitle: "",
    description: "",
    url,
    image: getImagePath(image),
    start: new Date(Math.min(...timelineRoles.map((role) => role.start.getTime()))),
    end: timelineRoles.some((role) => role.end === null)
      ? null
      : new Date(Math.max(...timelineRoles.map((role) => role.end!.getTime()))),
    isPointInTime: false,
    roles: timelineRoles,
  };
}

export function getTimelineEvents(): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  lifeData.forEach((event, index) => {
    events.push({
      id: `life-${index}`,
      category: "life",
      title: event.title,
      subtitle: event.subtitle,
      description: event.description ?? "",
      image: getImagePath(event.image),
      start: new Date(event.date),
      end: toDate((event as { end?: string }).end),
      isPointInTime: event.isPointInTime ?? true,
    });
  });

  educationData.forEach((education, index) => {
    events.push({
      id: `education-${index}`,
      category: "education",
      title: education.degree
        ? `${education.degree}${education.field ? " – " + education.field : ""}`
        : education.field,
      subtitle: education.school,
      description: education.description?.replace(/https?:\/\/\S+/g, "").trim() ?? "",
      url: education.url ?? undefined,
      image: getImagePath((education as WithImage).image),
      start: new Date(education.start),
      end: toDate(education.end),
      isPointInTime: false,
    });
  });

  workData.forEach((job, index) => {
    events.push(groupRoles("work", index, job.company, job.url, (job as WithImage).image, job.roles));
  });

  volunteeringData.forEach((organisation, index) => {
    events.push(
      groupRoles(
        "volunteer",
        index,
        organisation.org,
        organisation.url,
        (organisation as WithImage).image,
        organisation.roles,
      ),
    );
  });

  certificationsData.forEach((certification, index) => {
    events.push({
      id: `certification-${index}`,
      category: "certification",
      title: certification.name,
      subtitle: certification.issuer,
      description: "",
      url: certification.url ?? undefined,
      image: getImagePath((certification as WithImage).image),
      start: new Date(certification.date),
      end: null,
      isPointInTime: true,
    });
  });

  return events.sort((a, b) => {
    if (isOngoing(a) !== isOngoing(b)) return isOngoing(a) ? -1 : 1;
    return (b.end ?? b.start).getTime() - (a.end ?? a.start).getTime();
  });
}

export function isOngoing(event: TimelineEvent) {
  return !event.isPointInTime && event.end === null;
}

export function endOf(item: { start: Date; end: Date | null; isPointInTime?: boolean }, now: Date) {
  if (item.isPointInTime) return item.start;
  return item.end ?? now;
}

export function assignLanes(items: { id: string; start: Date; end: Date | null }[], now: Date) {
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();

  for (const item of [...items].sort((a, b) => a.start.getTime() - b.start.getTime())) {
    const start = item.start.getTime();
    let lane = laneEnds.findIndex((end) => end <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(0);
    }
    laneEnds[lane] = endOf(item, now).getTime();
    lanes.set(item.id, lane);
  }

  return { lanes, count: laneEnds.length };
}

export function getCoveredTime(items: { start: Date; end: Date | null }[], now: Date) {
  const intervals = items
    .map((item) => [item.start.getTime(), endOf(item, now).getTime() + MS_PER_DAY])
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let [currentStart, currentEnd] = intervals[0];
  for (const [start, end] of intervals.slice(1)) {
    if (start > currentEnd) {
      total += currentEnd - currentStart;
      [currentStart, currentEnd] = [start, end];
    } else {
      currentEnd = Math.max(currentEnd, end);
    }
  }
  return total + (currentEnd - currentStart);
}

export function formatDuration(milliseconds: number, locale: string, formatDays: (days: number) => string) {
  if (milliseconds < MS_PER_MONTH) {
    return formatDays(Math.max(1, Math.round(milliseconds / MS_PER_DAY)));
  }

  const totalMonths = Math.round(milliseconds / MS_PER_MONTH);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return new Intl.DurationFormat(locale, { style: locale === "en" ? "long" : "short" }).format({
    ...(years > 0 && { years }),
    ...(months > 0 && { months }),
  });
}

export function createTimeScale(events: TimelineEvent[], now: Date, focusShare = 0.75) {
  const min = Math.min(...events.map((event) => event.start.getTime()));
  const max = now.getTime();
  const firstJob = Math.min(
    ...events
      .filter((event) => event.category === "work" || event.category === "volunteer")
      .map((event) => event.start.getTime()),
  );
  const focusStart = new Date(new Date(firstJob).getFullYear(), 0, 1).getTime();
  const compressedShare = 1 - focusShare;

  const toPercent = (date: Date) => {
    const time = Math.min(Math.max(date.getTime(), min), max);
    const fraction =
      time <= focusStart
        ? ((time - min) / (focusStart - min)) * compressedShare
        : compressedShare + ((time - focusStart) / (max - focusStart)) * focusShare;
    return fraction * 100;
  };

  const focusYear = new Date(focusStart).getFullYear();
  const ticks: { year: number; percent: number; label: boolean; compressed: boolean }[] = [];
  for (let year = new Date(min).getFullYear() + 1; year <= new Date(max).getFullYear(); year++) {
    if (year < focusYear && year % 5 !== 0) continue;
    const percent = toPercent(new Date(year, 0, 1));
    const label =
      percent > 4 &&
      percent < 96 &&
      (year < focusYear ? percent < compressedShare * 100 - 8 : (year - focusYear) % 2 === 0);
    ticks.push({ year, percent, label, compressed: year < focusYear });
  }

  return { toPercent, compressedPercent: compressedShare * 100, ticks };
}
