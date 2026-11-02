import { extractAndIndex } from "./appointment_ocr_service.ts";

const pdf = process.env.PDF_BASE64;
if (!pdf) throw new Error("PDF_BASE64 is required");

const result = await extractAndIndex({
  patient_id: "local-fixture",
  appointment_id: "appointment-demo",
  appointment_time: "2026-11-01T09:30:00.000Z",
  recipient: "front-desk",
  pdf_base64: pdf
});

console.log(JSON.stringify({ text: result.text, notification: result.notification, matches: result.matches }, null, 2));
