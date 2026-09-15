import { NextResponse } from "next/server";

type PolyPizzaItem = {
  id?: string;
  name?: string;
  thumbnail?: string;
  thumbnailUrl?: string;
  glb?: string;
  glbUrl?: string;
};

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("query")?.trim();
  if (!query) return NextResponse.json({ models: [] });

  try {
    const response = await fetch(
      `https://api.poly.pizza/v1/search?query=${encodeURIComponent(query)}`,
      { next: { revalidate: 300 } }
    );
    if (!response.ok) return NextResponse.json({ models: [] });
    const payload = (await response.json()) as { results?: PolyPizzaItem[] };
    const models = (payload.results ?? []).map((item) => ({
      id: item.id ?? item.name,
      name: item.name ?? "Poly Pizza model",
      thumbnailUrl: item.thumbnailUrl ?? item.thumbnail ?? null,
      glbUrl: item.glbUrl ?? item.glb ?? null
    }));
    return NextResponse.json({ models });
  } catch {
    return NextResponse.json({ models: [] });
  }
}
