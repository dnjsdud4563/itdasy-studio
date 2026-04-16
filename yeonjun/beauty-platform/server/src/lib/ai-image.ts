type GenerateOpts = {
  prompt: string;
  style?: 'natural' | 'glam' | 'vintage' | 'kbeauty';
  referenceImageUrl?: string;
};

const STYLE_PROMPT: Record<NonNullable<GenerateOpts['style']>, string> = {
  natural: 'natural K-beauty makeup, soft lighting, dewy skin',
  glam: 'glamorous makeup, bold eyes, high fashion editorial',
  vintage: 'retro 90s Korean beauty, warm tones, film grain',
  kbeauty: 'pure K-beauty look, glass skin, pastel palette',
};

export async function generateImage(opts: GenerateOpts): Promise<{ imageUrl: string; latencyMs: number }> {
  const styleKey = opts.style ?? 'natural';
  const enhancedPrompt = `${opts.prompt}, ${STYLE_PROMPT[styleKey]}`;
  const encoded = encodeURIComponent(enhancedPrompt);

  const started = Date.now();
  const imageUrl = `https://image.pollinations.ai/prompt/${encoded}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

  // Pollinations는 GET 요청 시 이미지를 생성하고 반환. prefetch로 생성 트리거.
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Pollinations ${res.status}`);

  return { imageUrl, latencyMs: Date.now() - started };
}

export async function fetchImageBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch image ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
