import { NextRequest, NextResponse } from "next/server";
import { computeNextServiceDue, getServiceStatus } from "@/lib/maintenanceSchedule";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const mileage = Number(body.mileage);
    const lastServiceDate = String(body.lastServiceDate || "");

    if (!Number.isFinite(mileage) || mileage < 0) {
      return NextResponse.json(
        { error: "A valid, non-negative mileage is required" },
        { status: 400 }
      );
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastServiceDate)) {
      return NextResponse.json(
        { error: "lastServiceDate must be an ISO date (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    const nextDue = computeNextServiceDue(mileage, lastServiceDate);
    const schedule = getServiceStatus(mileage);

    return NextResponse.json({ nextDue, schedule });
  } catch (err) {
    console.error("POST /api/schedule failed:", err);
    return NextResponse.json(
      { error: "Failed to compute schedule" },
      { status: 500 }
    );
  }
}
