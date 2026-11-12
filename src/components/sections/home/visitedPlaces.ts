import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import countries from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topology from "world-atlas/countries-110m.json";

import type { Locale } from "@i18n/index";

export const HOME = "NO";

type Visit = number | `${number}/${number}`;

export const VISITED: Record<string, Visit[]> = {
  DK: [],
  SE: [],
  ES: [],
  GI: [],
  FR: [],
  TH: ["2008/2009"],
  IE: [2009],
  US: [2010, 2014],
  CO: [2010],
  MX: [2012, 2013],
  GB: [2012],
  HU: [2014],
  IT: [2018, 2022, 2026],
  JP: [2019, 2023, 2025],
  PL: [2019, 2024, 2025],
  PT: [2021],
  HR: [2022, 2026],
  GR: [2022, 2026],
  VA: [2022],
  KR: [2023],
  TW: [2023],
  HK: [2023, 2026],
  VN: [2023],
  FI: [2024, 2025],
  NL: [2025],
  DE: [2025, 2026],
  CZ: [2025, 2026],
  AT: [2025, 2026],
  SK: [2025],
  SI: [2025, 2026],
  CH: [2025],
  LI: [2025],
  LU: [2025],
  BE: [2025],
  MO: [2026],
  CN: [2026],
  ME: [2026],
  AL: [2026],
  MK: [2026],
  TR: [2026],
  GE: [2026],
  AZ: [2026],
  KZ: [2026],
  UZ: [2026],
  TJ: [2026],
  KG: [2026],
};

// Places too small to be included in the 110m world atlas, drawn as dots instead. [longitude, latitude]
const SMALL_PLACES: Record<string, [number, number]> = {
  AD: [1.52, 42.51],
  BH: [50.56, 26.07],
  GI: [-5.35, 36.14],
  HK: [114.17, 22.32],
  LI: [9.55, 47.16],
  MC: [7.42, 43.74],
  MO: [113.54, 22.19],
  MT: [14.38, 35.94],
  MV: [73.22, 3.2],
  SG: [103.82, 1.35],
  SM: [12.46, 43.94],
  VA: [12.45, 41.9],
};

// The long names of these are e.g. "Hong Kong SAR China"
const SHORT_NAMED = new Set(["HK", "MO"]);

// Features without an ISO numeric id in the atlas
const UNCODED: Record<string, string> = {
  Kosovo: "XK",
};

export const WIDTH = 1000;

const projection = geoNaturalEarth1().fitWidth(WIDTH, { type: "Sphere" });
const path = geoPath(projection).digits(1);

export const HEIGHT = Math.ceil(path.bounds({ type: "Sphere" })[1][1]);
export const SPHERE = path({ type: "Sphere" }) ?? "";

type Status = "home" | "visited" | "unvisited";

const statusOf = (code: string | undefined): Status =>
  code === HOME ? "home" : code && Object.hasOwn(VISITED, code) ? "visited" : "unvisited";

// Two regional indicator symbols, which most platforms render as the country's flag
const flagOf = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map((char) => 0x1f1e6 + char.charCodeAt(0) - 65));

const startYear = (visit: Visit) => (typeof visit === "number" ? visit : Number(visit.split("/")[0]));

// [2024, "2008/2009", 2025] -> "2008–2009, 2024, 2025"
const formatYears = (visits: Visit[]) =>
  [...new Set(visits)]
    .sort((a, b) => startYear(a) - startYear(b))
    .map((visit) => String(visit).replace("/", "–"))
    .join(", ");

// Catch entries that are out of order according to their years
Object.entries(VISITED).reduce<{ code: string; year: number } | undefined>((previous, [code, years]) => {
  if (years.length === 0) return previous;
  const year = Math.min(...years.map(startYear));
  if (previous && year < previous.year) {
    console.warn(
      `VisitedPlaces: "${code}" (${year}) is listed after "${previous.code}" (${previous.year}), but VISITED should be in the order of first visit`,
    );
  }
  return previous && previous.year > year ? previous : { code, year };
}, undefined);

const topo = topology as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const features = (feature(topo, topo.objects.countries) as { features: Feature<Geometry, { name: string }>[] })
  .features;

// Geometry is locale independent, so it is projected once per process
const shapes = features.map((f) => {
  const code = (f.id && countries.numericToAlpha2(f.id)) || UNCODED[f.properties.name];
  return { code, fallbackName: f.properties.name, d: path(f) ?? "", status: statusOf(code) };
});

const drawnCodes = new Set(shapes.map((s) => s.code));

const dots = [...Object.keys(VISITED), HOME]
  .filter((code) => !drawnCodes.has(code))
  .flatMap((code) => {
    const coordinates = SMALL_PLACES[code];
    const point = coordinates && projection(coordinates);
    if (!point) {
      console.warn(`VisitedPlaces: no shape or coordinates for "${code}", add it to SMALL_PLACES`);
      return [];
    }
    const [cx, cy] = point.map((n) => Math.round(n * 10) / 10);
    return [{ code, cx, cy, status: statusOf(code) }];
  });

export function getMap(locale: Locale) {
  const names = new Intl.DisplayNames([locale], { type: "region", fallback: "none" });
  const shortNames = new Intl.DisplayNames([locale], { type: "region", style: "short", fallback: "none" });
  const nameOf = (code: string | undefined, fallback = "") =>
    (code && (SHORT_NAMED.has(code) ? shortNames : names).of(code)) || fallback;

  return {
    countries: shapes.map((s) => ({ ...s, name: nameOf(s.code, s.fallbackName) })),
    dots: dots.map((d) => ({ ...d, name: nameOf(d.code, d.code) })),
    // Alphabetical, with `firstVisit` being the position in VISITED
    visited: Object.entries(VISITED)
      .map(([code, years], firstVisit) => ({
        code,
        firstVisit,
        flag: flagOf(code),
        name: nameOf(code, code),
        years: formatYears(years),
      }))
      .sort((a, b) => a.name.localeCompare(b.name, locale)),
  };
}
