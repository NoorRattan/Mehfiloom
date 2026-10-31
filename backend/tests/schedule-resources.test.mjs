import assert from "node:assert/strict";
import test from "node:test";
import {
  dateInTimeZone,
  isValidIanaTimeZone,
  resolveZonedDateTime,
} from "../lib/schedule.ts";

test("case variants reuse a native formatter instead of retaining each spelling", (t) => {
  const Original = Intl.DateTimeFormat;
  let created = 0;
  t.mock.method(Intl, "DateTimeFormat", function (...args) {
    created += 1;
    return new Original(...args);
  });
  const zone = "America/Argentina/Buenos_Aires";
  for (let variant = 0; variant < 512; variant += 1) {
    let letter = 0;
    const spelling = zone.replace(/[a-z]/gi, (char) =>
      (variant >> (letter++ % 9)) & 1 ? char.toUpperCase() : char.toLowerCase(),
    );
    assert.equal(
      dateInTimeZone(new Date("2027-01-01T01:00:00Z"), spelling),
      "2026-12-31",
    );
  }
  assert.equal(created, 1);
});

test("many valid zones evict old formatters while keeping recent ones reusable", (t) => {
  const Original = Intl.DateTimeFormat;
  let created = 0;
  t.mock.method(Intl, "DateTimeFormat", function (...args) {
    created += 1;
    return new Original(...args);
  });
  const zones = Intl.supportedValuesOf("timeZone").slice(0, 100);
  for (const zone of zones) assert.equal(isValidIanaTimeZone(zone), true);
  const afterFill = created;
  assert.equal(isValidIanaTimeZone(zones.at(-1)), true);
  assert.equal(created, afterFill, "recent formatter remains available");
  assert.equal(isValidIanaTimeZone(zones[0]), true);
  assert.equal(
    created,
    afterFill + 1,
    "old formatter was released, not retained forever",
  );
  assert.equal(isValidIanaTimeZone("not-a-zone"), false);
});

test("named zones keep historical second precision and reject bare fixed offsets", () => {
  const result = resolveZonedDateTime("1900-01-01", "12:00", "Europe/Paris");
  assert.equal(result.status, "unique");
  assert.equal(result.instant, "1900-01-01T11:50:39.000Z");
  for (const offset of ["+01:00", "-0330", "+01"]) {
    assert.equal(isValidIanaTimeZone(offset), false);
    assert.equal(
      resolveZonedDateTime("2027-01-01", "12:00", offset).status,
      "invalid",
    );
  }
  assert.equal(
    isValidIanaTimeZone("Etc/GMT+5"),
    true,
    "named IANA fixed zones remain valid",
  );
});
