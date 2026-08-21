import assert from "node:assert/strict";
import test from "node:test";
import {
  applyCardEntryTemplateValues,
  normalizeCardEntryTemplateName,
  normalizeCardEntryTemplateValues
} from "../lib/card-entry-template-domain.ts";
import { normalizeCardFormValues } from "../lib/card-entry-domain.ts";
import { scoreCardEntryDuplicate } from "../lib/card-entry-duplicate-domain.ts";
import {
  lowConfidenceCardRecognitionFields,
  normalizeCardRecognitionResult
} from "../lib/card-recognition-domain.ts";

test("entry templates keep only reusable public fields", () => {
  const template = normalizeCardEntryTemplateValues({
    playerName: "Should not persist",
    sport: "Basketball",
    team: "Lakers",
    year: "2025-26",
    productLine: "Prizm",
    cardNumber: "99",
    tags: "rookie, silver",
    visibility: "public",
    collectionStatus: "holding"
  });
  assert.deepEqual(Object.keys(template), [
    "sport", "team", "year", "brand", "productLine", "subsetName",
    "visibility", "collectionStatus", "tags"
  ]);
  assert.equal(template.productLine, "Prizm");
  assert.equal("playerName" in template, false);
  assert.equal("cardNumber" in template, false);
  assert.equal(normalizeCardEntryTemplateName("  同套   Prizm  "), "同套 Prizm");

  const current = normalizeCardFormValues({ playerName: "Kobe", cardNumber: "8" });
  const applied = applyCardEntryTemplateValues(current, template);
  assert.equal(applied.playerName, "Kobe");
  assert.equal(applied.cardNumber, "8");
  assert.equal(applied.team, "Lakers");
});

test("duplicate scoring is deterministic and non-blocking", () => {
  const input = normalizeCardFormValues({
    playerName: "Kobe Bryant",
    year: "1996-97",
    brand: "Topps",
    productLine: "Chrome",
    cardNumber: "138",
    parallel: "Refractor"
  });
  const high = scoreCardEntryDuplicate(input, {
    playerName: " kobe  bryant ",
    year: "1996-97",
    brand: "Topps",
    productLine: "Chrome",
    cardNumber: "138",
    parallel: "Refractor"
  });
  assert.equal(high?.level, "high");
  assert.ok(high?.matches.includes("卡号"));
  assert.equal(scoreCardEntryDuplicate(input, {
    playerName: "Kobe Bryant",
    year: "2024"
  }), null);
  assert.equal(scoreCardEntryDuplicate(input, {
    playerName: "LeBron James",
    year: "1996-97",
    cardNumber: "138"
  }), null);
});

test("AI recognition candidates are allowlisted and expose low confidence", () => {
  const result = normalizeCardRecognitionResult({
    fields: {
      playerName: " Kobe Bryant ",
      cardNumber: "138",
      isRookie: true,
      purchasePrice: "100",
      notes: "do not keep"
    },
    confidence: {
      playerName: "high",
      cardNumber: "low",
      isRookie: "medium",
      notes: "high"
    }
  });
  assert.deepEqual(result.suggestion, {
    playerName: "Kobe Bryant",
    cardNumber: "138",
    isRookie: true
  });
  assert.deepEqual(lowConfidenceCardRecognitionFields(result.confidence), ["cardNumber"]);
});
