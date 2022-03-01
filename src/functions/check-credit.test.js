const checkCredit = require("./check-credit");
const db = require("../db/instance");

beforeAll(async () => {
  await db.connect();
});

beforeEach(async () => {
  const col = await db.getCollection("CheckCreditUser");
  const deleteManyRes = await col.deleteMany({});
  console.log(deleteManyRes);
});

afterAll(async () => {
  await db.close();
});

describe("checkCredit", () => {
  test("test if something", async () => {
    const result = await checkCredit("12345678912");
    expect(result).toEqual(1);
  }, 10000);
});
