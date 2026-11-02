import assert from "node:assert/strict";
import test from "node:test";
import { parseAppointmentRequest, patientSafeNotification } from "./appointment_ocr_service.ts";

test("appointment reminder omits the patient identifier", () => {
  const request = parseAppointmentRequest({
    patient_id: "p-17",
    appointment_id: "apt-42",
    appointment_time: "2026-11-01T09:30:00.000Z",
    recipient: "front-desk",
    pdf_base64: "JVBERi0x"
  });
  const message = patientSafeNotification(request);
  assert.equal(message, "Appointment apt-42 is scheduled for 2026-11-01T09:30:00.000Z. Please review the appointment queue.");
  assert.equal(message.includes("p-17"), false);
});

test("request boundary rejects a missing PDF", () => {
  assert.throws(() => parseAppointmentRequest({ appointment_id: "apt-42" }));
});
