import { NextResponse } from "next/server";
// TODO: Créer getClientLettering dans src/lib/serverActions/ledgers
import { getClientLettering } from "@/lib/serverActions/ledgers";

export async function GET(req, { params }) {
  const { id } = await params;
  const clientId = id;
  if (!clientId) {
    return NextResponse.json({ error: "clientId requis" }, { status: 400 });
  }
  try {
    const data = await getClientLettering({ clientId });
    return NextResponse.json(data);
  } catch (error) {
    console.error("getClientLettering failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
