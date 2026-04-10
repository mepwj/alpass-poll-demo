import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL!;
const API_KEY = process.env.API_KEY!;

export async function POST(req: NextRequest) {
  const { businessId, inputVariables } = await req.json();

  const res = await fetch(
    `${API_URL}/openapi/v1/businesses/id/${businessId}/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ inputVariables }),
    }
  );

  const data = await res.json();
  return NextResponse.json(data);
}
