const MAX_IMAGE_BASE64_LENGTH = 10 * 1024 * 1024;
const DATA_URL_PATTERN = /^data:(image\/(jpeg|png|webp|gif));base64,[A-Za-z0-9+/]+=*$/;

export function validateImageBase64(imageBase64: string): { valid: boolean; error?: string } {
  if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
    return { valid: false, error: "Image is too large. Please upload an image under 4MB." };
  }

  const headerMatch = imageBase64.match(/^data:(image\/[^;]+);base64,/);
  if (!headerMatch) {
    return { valid: false, error: "Invalid image format. Please upload a JPEG, PNG, WebP, or GIF image." };
  }

  const mimeType = headerMatch[1];
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
  if (!allowedTypes.has(mimeType)) {
    return { valid: false, error: "Unsupported image type. Please upload a JPEG, PNG, WebP, or GIF image." };
  }

  return { valid: true };
}

const VISION_PROMPT = `You are a product identification assistant. Analyze this image and describe the product(s) shown in detail for a shopping search query. Include:
- Product type/category
- Colors and patterns
- Material (if identifiable)
- Style characteristics
- Any brand logos or text visible
- Key distinguishing features

Format your response as a concise product search description (1-3 sentences) that would help find similar products in a store.`;

const VISION_CAPABLE_PROVIDERS = new Set(["openai", "gemini"]);

export function isVisionCapable(provider: string): boolean {
  return VISION_CAPABLE_PROVIDERS.has(provider);
}

export async function describeImageWithVision(
  provider: "openai" | "anthropic" | "xai" | "gemini",
  apiKey: string,
  model: string,
  imageBase64: string,
  userMessage?: string
): Promise<string> {
  if (!isVisionCapable(provider)) {
    throw new Error(`Provider "${provider}" does not support vision/image input`);
  }

  const promptText = userMessage
    ? `${VISION_PROMPT}\n\nThe user also said: "${userMessage}"`
    : VISION_PROMPT;

  if (provider === "openai") {
    return describeWithOpenAI(apiKey, model, imageBase64, promptText);
  } else if (provider === "gemini") {
    return describeWithGemini(apiKey, model, imageBase64, promptText);
  }

  throw new Error(`Vision not implemented for provider "${provider}"`);
}

async function describeWithOpenAI(
  apiKey: string,
  model: string,
  imageBase64: string,
  prompt: string
): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: { url: imageBase64, detail: "low" },
            },
          ],
        },
      ],
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`OpenAI vision API error (${response.status}): ${errorBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };
  return data.choices?.[0]?.message?.content || "Unable to describe the image.";
}

async function describeWithGemini(
  apiKey: string,
  model: string,
  imageBase64: string,
  prompt: string
): Promise<string> {
  const base64Match = imageBase64.match(/^data:(image\/[^;]+);base64,(.+)$/);
  if (!base64Match) {
    throw new Error("Invalid base64 image format");
  }
  const mimeType = base64Match[1];
  const base64Data = base64Match[2];

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 300,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(`Gemini vision API error (${response.status}): ${errorBody.slice(0, 200)}`);
  }

  const data = (await response.json()) as {
    candidates: Array<{
      content: { parts: Array<{ text?: string }> };
    }>;
  };

  const text = data.candidates?.[0]?.content?.parts
    ?.map((p) => p.text || "")
    .join("");

  return text || "Unable to describe the image.";
}
