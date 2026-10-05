import { NextRequest, NextResponse } from "next/server";
import { nhtsaFetch, parseVehicle, resultsOf, clip } from "@/lib/nhtsa";

// NHTSA 5-Star Safety Ratings. Two steps: list the vehicle variants for the
// model year, then fetch the rating detail for each (capped at 4).
export async function GET(req: NextRequest) {
  const v = parseVehicle(req);
  if (!v) return NextResponse.json({ error: "year, make and model are required" }, { status: 400 });

  try {
    const list = await nhtsaFetch(
      `/SafetyRatings/modelyear/${v.year}/make/${encodeURIComponent(
        v.make
      )}/model/${encodeURIComponent(v.model)}?format=json`
    );
    const variants = resultsOf(list).slice(0, 4);

    const details = await Promise.all(
      variants.map(async (variant) => {
        try {
          const d = resultsOf(await nhtsaFetch(`/SafetyRatings/VehicleId/${variant.VehicleId}?format=json`))[0];
          if (!d) return null;
          return {
            id: variant.VehicleId,
            description: clip(d.VehicleDescription ?? variant.VehicleDescription, 120),
            overall: d.OverallRating,
            frontal: d.OverallFrontCrashRating,
            side: d.OverallSideCrashRating,
            rollover: d.RolloverRating,
            rolloverChance: d.RolloverPossibility,
            sidePole: d.SidePoleCrashRating,
            features: {
              electronicStabilityControl: d.NHTSAElectronicStabilityControl,
              forwardCollisionWarning: d.NHTSAForwardCollisionWarning,
              laneDepartureWarning: d.NHTSALaneDepartureWarning,
            },
            picture: typeof d.VehiclePicture === "string" ? d.VehiclePicture : null,
          };
        } catch {
          return null;
        }
      })
    );

    return NextResponse.json({ ratings: details.filter(Boolean) });
  } catch (err) {
    console.error("GET /api/nhtsa/safety failed:", err);
    return NextResponse.json({ error: "Could not reach NHTSA ratings" }, { status: 502 });
  }
}
