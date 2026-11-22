// @vitest-environment jsdom
import { expect, it } from "vitest";
import { mockHealthApi } from "./mock";
import type { Entry } from "./types";

it("keeps symptom-only entries and rejects partial changes when a symptom command fails", async () => {
  localStorage.setItem("vitap-user-email", `${crypto.randomUUID()}@example.test`);
  const created = await mockHealthApi<Entry>("/entries", "POST", {
    symptoms: [{ symptom_name: "Synthetic symptom", severity: 4, duration_minutes: 0 }],
  });
  const symptom = created.symptoms![0];
  const path = `/entries/${created.id}`;
  expect(symptom).toMatchObject({ entry_id: created.id, severity: 4, duration_minutes: 0 });
  await expect(mockHealthApi(`${path}/symptoms/${symptom.id}`, "DELETE")).rejects.toMatchObject({ status: 409 });
  await expect(mockHealthApi(`${path}/aggregate`, "PATCH", {
    entry: { title: "Must roll back" }, symptoms: { update: [{ id: symptom.id, severity: 11 }] },
  })).rejects.toMatchObject({ status: 422 });
  expect(await mockHealthApi(path)).toEqual(created);
  const patched = await mockHealthApi<Entry>(`${path}/aggregate`, "PATCH", {
    observations: { create: [{ observation_type: "HEART_RATE", value: 72, unit: "bpm" }] },
    symptoms: { delete: [symptom.id] },
  });
  expect(patched.symptoms).toEqual([]);
  expect(patched.observations).toHaveLength(1);
});
