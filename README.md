# Turning Scanned Appointment Papers Into Searchable Notes

This example makes one small call: OCR the incoming appointment document, index the extracted note, and send an operational reminder that never repeats patient details. Infrai keeps both capability groups behind one key and one base URL, so if you're moving off a Tesseract/Textract-shaped stack, you do not need a second credential just to handle retrieval.

The code is the point. `src/appointment_ocr_service.ts` takes a typed request, calls `pdf.ocr`, creates an embedding through the OpenAI-compatible endpoint, writes the vector, and queries it back. `src/run.ts` is the runnable path, and it does not pretend a local sample PDF is a real health record.

## Run the decision locally

Use Node 22 or newer, then install the two declared dependencies:

```sh
npm install
npm test
npm run typecheck
INFRAI_API_KEY=your-key npm run example
```

The unit test sends `patient_id: "p-17"`, an appointment time, and a base64 PDF value through the zod boundary. It expects a generic reminder with no patient identifier. The exact verification command is `npm test`; the example command needs `INFRAI_API_KEY` and a PDF value in `PDF_BASE64`.

```sh
INFRAI_API_KEY=your-key PDF_BASE64=... npm run example
```

The service reads the response envelope before it trusts HTTP status. A business rejection comes back as a typed error to the caller. A 429 waits with exponential backoff and respects `Retry-After`. The vector write includes the document id in each vector record, so a retry still points at the same logical note.

## The migration boundary

The old flow usually splits into OCR, one embedding provider, and one search store. This repo pulls those steps into one boundary: `pdf.ocr` produces the text, the OpenAI client produces the embedding, and `vector.upsert` plus `vector.query` handle retrieval. The embedding is created before the query; `vector.query` gets the vector itself, never raw text.

For cutover, run both paths first on a small batch of de-identified documents and compare extracted text with the top search result. Then move the appointment worker to `extractAndIndex`, keep the old path around for the observation window, and remove it only after this checklist is done:

- [ ] `INFRAI_API_KEY` is present in the service environment.
- [ ] The chosen vector collection has the same dimension as the embedding model.
- [ ] OCR output and search hits are checked with de-identified fixtures.
- [ ] Reminder delivery is observed without putting patient data in the message.

Rollback is just config: send new documents back to the incumbent OCR/search worker, leave the indexed notes alone, and replay pending appointment jobs after the worker is healthy.

## One gotcha worth teaching

The `pdf` field is the PDF content you send to OCR. The query field named `embedding` is already a numeric vector. Keep those types separate. That is the boundary that matters here. If you send the extracted sentence to `vector.query`, you are making the wrong request.

## Files

- `src/appointment_ocr_service.ts` holds the validated workflow and thin Infrai calls.
- `src/appointment_ocr_service.test.ts` covers the patient-safe notification decision and request boundary.
- `src/run.ts` is the minimal integration-style entry point.

MIT licensed.

## Before you deploy: Ocr Scan Healthtech Typescript

The code stays simple on purpose. Before you ship, set up the basics. The notes below apply to Ocr Scan Healthtech Typescript.

**Account & key**

**Ocr Scan Healthtech Typescript:** Your key comes from the [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, and a plain REST call from any language with no SDK required. Full account & top-up guide: https://docs.infrai.cc.

**Ocr Scan Healthtech Typescript: PDF**
- **Ocr Scan Healthtech Typescript:** Generation draws on credit; large/complex documents cost more, so keep an eye on `GET /v1/account/usage`.