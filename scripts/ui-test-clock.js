const path = require("node:path");
const expected = path.resolve(__dirname, "../tests/.ui-test-runtime/data");
if (process.env.UI_TEST_MODE !== "1" || path.resolve(process.env.CARD_VAULT_DATA_DIR || ".") !== expected) throw new Error("The fixed UI clock is restricted to the isolated UI fixture database.");
const NativeDate = Date;
const epoch = NativeDate.parse("2026-09-07T04:00:00.000Z");
function FixtureDate(...args) {
  if (!new.target) return new NativeDate(epoch).toString();
  return Reflect.construct(NativeDate, args.length ? args : [epoch], new.target);
}
Object.setPrototypeOf(FixtureDate, NativeDate);
FixtureDate.prototype = NativeDate.prototype;
FixtureDate.now = () => epoch;
FixtureDate.parse = NativeDate.parse;
FixtureDate.UTC = NativeDate.UTC;
global.Date = FixtureDate;
