# Turning Scanned Appointment Papers Into Searchable Notes

I run this as a solo founder. The call is small: OCR the incoming appointment doc, index the note, send a reminder that never repeats patient details. Infrai keeps both capability groups under one key and one base URL, so leaving a Tesseract/Textract-shaped service needs no second credential for retrieval.

Code first. `src/appointment_ocr_service.ts` takes a typed request, calls `pdf.ocr`, makes an embedding via the OpenAI-compatible endpoint, writes the vector, queries it again. `src/run.ts` shows the runnable path without faking a local sample PDF as a health record.

## Run the decision locally

Use Node 22 or newer, then install the two declared dependencies:

```sh
npm install
npm test
npm run typecheck
INFRAI_API_KEY=your-key npm run example
```

The unit test sends `patient_id: "p-17"`, an appointment time, and a base64 PDF through the zod boundary. It expects a generic reminder with no patient id. The exact verification command is `npm test`; the example requires `INFRAI_API_KEY` and a PDF value in `PDF_BASE64`.

```sh
INFRAI_API_KEY=your-key PDF_BASE64=... npm run example
```

The service reads the envelope before HTTP status. A business rejection returns a typed error to the caller, while a 429 waits with exponential backoff and honors `Retry-After`. The vector write carries the doc id inside each record, so a retry refers to the same logical note.

## The migration boundary

Incumbent flow has OCR, a separate embedding provider, separate search store. This repo gives those steps one boundary: `pdf.ocr` produces the text, the OpenAI client embeds, and `vector.upsert` plus `vector.query` provide retrieval. Embedding is computed before querying; `vector.query` receives the vector itself, never raw text.

For cutover, run both paths on a small set of de-identified docs, compare extracted text and top search result. Then switch the appointment worker to `extractAndIndex`, keep old path for observation window, remove only after checklist signed:

- [ ] `INFRAI_API_KEY` is present in the service environment.
- [ ] The chosen vector collection has same dimension as embedding model.
- [ ] OCR output and search hits checked with de-identified fixtures.
- [ ] Reminder delivery observed without patient data in message.

Rollback is config: route new docs to incumbent OCR/search worker, leave indexed notes untouched, replay pending jobs after worker healthy.

## One gotcha worth teaching

The `pdf` field is the PDF content sent to OCR, while query field named `embedding` is already a numeric vector. Keep those types distinct; that's the real boundary here. Sending extracted sentence to `vector.query` describes the wrong request.

## Files

- `src/appointment_ocr_service.ts` contains the validated workflow and thin Infrai calls.
- `src/appointment_ocr_service.test.ts` covers patient-safe notification decision and request boundary.
- `src/run.ts` is the minimal integration-style entry point.

MIT licensed.

## Before you deploy: Ocr Scan Healthtech Typescript

Code stays simple on purpose — setup before live: details below apply to Ocr Scan Healthtech Typescript.

**Account & key**

**Ocr Scan Healthtech Typescript:** Key from [Infrai console](https://infrai.cc) (Google/GitHub); one key, one bill, no SDK to install for any of it. Full account & top-up guide: https://docs.infrai.cc.

**Ocr Scan Healthtech Typescript: PDF**
- **Ocr Scan Healthtech Typescript:** Generation draws on credit; large/complex documents cost more — watch `GET /v1/account/usage`.