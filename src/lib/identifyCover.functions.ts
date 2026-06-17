import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  imageBase64: z.string().min(100), // data URL or raw base64
});

export interface CoverIdentification {
  title: string;
  authors: string[];
  isbn?: string | null;
}

export const identifyCover = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<CoverIdentification | null> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const imageUrl = data.imageBase64.startsWith("data:")
      ? data.imageBase64
      : `data:image/jpeg;base64,${data.imageBase64}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You identify books from photos of their front cover. Reply with ONLY a JSON object: {\"title\": string, \"authors\": string[], \"isbn\": string|null}. If you cannot read the cover or it is not a book, return {\"title\": \"\", \"authors\": [], \"isbn\": null}.",
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "What book is this? Use the exact title and author shown on the cover.",
              },
              { type: "image_url", image_url: { url: imageUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (res.status === 429) throw new Error("Rate limited — please try again in a moment.");
    if (res.status === 402) throw new Error("AI credits exhausted. Add credits to keep scanning covers.");
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`AI error: ${txt.slice(0, 200)}`);
    }

    const json = await res.json();
    const content: string = json.choices?.[0]?.message?.content ?? "{}";
    try {
      const parsed = JSON.parse(content);
      if (!parsed.title) return null;
      return {
        title: String(parsed.title),
        authors: Array.isArray(parsed.authors) ? parsed.authors.map(String) : [],
        isbn: parsed.isbn ? String(parsed.isbn) : null,
      };
    } catch {
      return null;
    }
  });
