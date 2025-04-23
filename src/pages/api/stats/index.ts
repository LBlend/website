import { getAnilistData } from "./anilist";
import { getOsuData } from "./osu";
import { getSimklData } from "./simkl";
import { getSteamData } from "./steam";
import { getWakatimeData } from "./wakatime";

export async function GET() {
  const osuData = await getOsuData();
  const wakatimeData = await getWakatimeData();
  const anilistData = await getAnilistData();
  const steamData = await getSteamData();
  const simklData = await getSimklData();

  const finalData = {
    osu: osuData,
    wakatime: wakatimeData,
    anilist: anilistData,
    steam: steamData,
    simkl: simklData,
  };

  return new Response(JSON.stringify(finalData), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });
}
