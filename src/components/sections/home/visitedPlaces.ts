import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import countries from "i18n-iso-countries";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import topology from "world-atlas/countries-110m.json";

import type { Locale } from "@i18n/index";

export const HOME = "NO";

// ISO 3166-1 alpha-2 codes
export const VISITED = [
  "DK",
  "SE",
  "ES",
  "GI",
  "FR",
  "TH",
  "IE",
  "US",
  "CO",
  "MX",
  "GB",
  "HU",
  "IT",
  "JP",
  "PL",
  "PT",
  "HR",
  "GR",
  "VA",
  "KR",
  "TW",
  "HK",
  "VN",
  "FI",
  "NL",
  "DE",
  "CZ",
  "AT",
  "SK",
  "SI",
  "CH",
  "LI",
  "LU",
  "BE",
  "MO",
  "CN",
  "ME",
  "AL",
  "MK",
  "TR",
  "GE",
  "AZ",
  "KZ",
  "UZ",
  "TJ",
  "KG",
];

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
  code === HOME ? "home" : code && VISITED.includes(code) ? "visited" : "unvisited";

const topo = topology as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
const features = (feature(topo, topo.objects.countries) as { features: Feature<Geometry, { name: string }>[] })
  .features;

// Geometry is locale independent, so it is projected once per process
const shapes = features.map((f) => {
  const code = (f.id && countries.numericToAlpha2(f.id)) || UNCODED[f.properties.name];
  return { code, fallbackName: f.properties.name, d: path(f) ?? "", status: statusOf(code) };
});

const drawnCodes = new Set(shapes.map((s) => s.code));

const dots = [...VISITED, HOME]
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
    visitedNames: VISITED.map((code) => nameOf(code, code)).sort((a, b) => a.localeCompare(b, locale)),
  };
}
