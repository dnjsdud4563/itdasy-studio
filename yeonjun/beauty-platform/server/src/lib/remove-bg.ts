import { config } from '../config.js';

const MODEL_URL = 'https://api-inference.huggingface.co/models/briaai/RMBG-2.0';

export async function removeBackground(imageBuffer: Buffer): Promise<Buffer> {
  const res = await fetch(MODEL_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.HF_ACCESS_TOKEN}`,
      'Content-Type': 'application/octet-stream',
    },
    body: new Uint8Array(imageBuffer),
  });

  if (!res.ok) {
    const text = await res.text();
    // 모델 로딩 중일 때 503 → 재시도
    if (res.status === 503) {
      throw new Error('MODEL_LOADING: model is loading, retry in a few seconds');
    }
    throw new Error(`RMBG ${res.status}: ${text.slice(0, 200)}`);
  }

  return Buffer.from(await res.arrayBuffer());
}
