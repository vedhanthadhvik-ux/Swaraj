import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Gemini is not configured yet. Add GEMINI_API_KEY to your environment." }, { status: 503 });
  }

  let payload: { claim?: string; context?: string; sourceUrl?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Send a valid JSON request." }, { status: 400 });
  }
  const claim = payload.claim?.trim();
  if (!claim || claim.length > 2000) {
    return NextResponse.json({ error: "Enter a claim of 1–2,000 characters." }, { status: 400 });
  }

  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const prompt = `You are a careful civic-information assistant, not a definitive fact-checker. Analyze the political/news claim below. You do not have browsing access and must not invent facts, citations, sources, dates, or quotes. If the supplied material does not independently establish the claim, classify it as Unverified. Use Mixed evidence only when the supplied text itself contains meaningful support and contradiction. Use Supported only when the supplied material clearly supports the claim; explicitly state that this is not independent verification. Never infer truth from political affiliation. Return only JSON with keys label (exactly Supported, Mixed evidence, or Unverified), summary (one concise paragraph), checks (array of up to 3 practical checks or observations), caveat (short limitation). Mention whether a source URL was supplied, but do not claim to have opened or verified it.

Claim: ${claim}
Context supplied by user: ${(payload.context || "None").slice(0, 4000)}
Source URL supplied: ${payload.sourceUrl || "None"}`;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.2 } }),
      signal: AbortSignal.timeout(25000)
    });
    if (!response.ok) {
      const message = await response.text();
      console.error("Gemini request failed:", response.status, message.slice(0, 500));
      return NextResponse.json({ error: "Gemini could not complete the analysis. Check the server key, model name, and quota." }, { status: 502 });
    }
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
    if (!text) throw new Error("Gemini returned an empty response");
    const result = JSON.parse(text);
    const allowed = ["Supported", "Mixed evidence", "Unverified"];
    if (!allowed.includes(result.label) || typeof result.summary !== "string") throw new Error("Unexpected Gemini response format");
    return NextResponse.json({
      label: result.label,
      summary: result.summary,
      checks: Array.isArray(result.checks) ? result.checks.slice(0, 3).map(String) : [],
      caveat: typeof result.caveat === "string" ? result.caveat : "AI-generated assessment; verify with independent sources."
    });
  } catch (error) {
    console.error("Claim analysis failed:", error);
    return NextResponse.json({ error: "Could not analyze this claim right now. Please try again." }, { status: 502 });
  }
}
