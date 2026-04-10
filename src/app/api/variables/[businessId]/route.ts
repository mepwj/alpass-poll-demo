import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL!;
const API_KEY = process.env.API_KEY!;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ businessId: string }> }
) {
  const { businessId } = await params;

  const res = await fetch(
    `${API_URL}/openapi/v1/businesses/id/${businessId}/variables`,
    {
      headers: { Authorization: `Bearer ${API_KEY}` },
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
