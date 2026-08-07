import assert from "node:assert/strict";
import test from "node:test";
import { toPublicExportCard } from "../lib/share-export-data.ts";
import type { ExportCardInput } from "../lib/share-export-types.ts";

test("share export mapping keeps only public card fields", () => {
  const input = {
    href: "cards/example.html",
    images: ["assets/images/example.jpg"],
    item: {
      displayTitle: null,
      displayDescription: null,
      card: {
        id: "card-example",
        playerName: "Player",
        cardTitle: "Card",
        sport: "Basketball",
        team: "Team",
        year: "2024",
        brand: "Brand",
        productLine: "Line",
        subsetName: null,
        parallel: null,
        cardNumber: "1",
        serialNumber: null,
        serialRange: null,
        isRookie: true,
        isAutograph: false,
        autoType: null,
        isPatch: false,
        patchType: null,
        gradingCompany: null,
        grade: null,
        certNumber: null,
        publicDescription: "Public",
        purchasePrice: 999,
        currentValue: 1200,
        purchaseSource: "Private source",
        notes: "Private note"
      }
    }
  } as unknown as ExportCardInput;

  const exported = toPublicExportCard(input);
  const exportedRecord = exported as unknown as Record<string, unknown>;

  assert.equal(exported.description, "Public");
  assert.equal(exported.id, "card-example");
  assert.equal("purchasePrice" in exportedRecord, false);
  assert.equal("currentValue" in exportedRecord, false);
  assert.equal("purchaseSource" in exportedRecord, false);
  assert.equal("notes" in exportedRecord, false);
});
