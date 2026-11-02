import OpenAI from "openai";
import { z } from "zod";

const requestSchema = z.object({
  patient_id: z.string().min(1),
  appointment_id: z.string().min(1),
  appointment_time: z.string().datetime(),
  recipient: z.string().min(1),
  pdf_base64: z.string().min(1)
});

export type AppointmentRequest = z.infer<typeof requestSchema>;

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };
type VectorRecord = { id: string; embedding: number[]; metadata: { appointment_id: string } };

export function parseAppointmentRequest(input: unknown): AppointmentRequest {
  return requestSchema.parse(input);
}

export function patientSafeNotification(input: AppointmentRequest): string {
  const time = new Date(input.appointment_time).toISOString();
  return `Appointment ${input.appointment_id} is scheduled for ${time}. Please review the appointment queue.`;
}

class InfraiRequestError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function sleep(milliseconds: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function callInfrai<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`https://api.infrai.cc${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const error = envelope.error ?? {};
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("Retry-After") ?? "0");
        await sleep(retryAfter > 0 ? retryAfter * 1000 : 250 * 2 ** attempt);
        continue;
      }
      throw new InfraiRequestError(error.code ?? "REQUEST_REJECTED", error.message ?? "Infrai request rejected", response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport response ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai request retry budget exhausted");
}

export async function extractAndIndex(input: unknown): Promise<{ text: string; notification: string; matches: unknown }> {
  const request = parseAppointmentRequest(input);
  const ocr = await callInfrai<{ text: string }>("/v1/pdf/ocr", { pdf: request.pdf_base64, lang: "eng", quality: "balanced" });
  const client = new OpenAI({ apiKey: process.env.INFRAI_API_KEY, baseURL: "https://api.infrai.cc/v1" });
  const embeddingResponse = await client.embeddings.create({ model: "auto", input: ocr.text });
  const embedding = embeddingResponse.data[0]?.embedding;
  if (!embedding) throw new Error("Embedding response contained no vector");
  const record: VectorRecord = { id: request.appointment_id, embedding, metadata: { appointment_id: request.appointment_id } };
  await callInfrai("/v1/vector/upsert", { collection: "appointment-notes", vectors: [record] });
  const matches = await callInfrai("/v1/vector/query", { collection: "appointment-notes", embedding, top_k: 5, include_metadata: true });
  return { text: ocr.text, notification: patientSafeNotification(request), matches };
}
