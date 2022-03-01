const names = require("../dataset/names.json");
const lastNames = require("../dataset/lastnames.json");
const { sleep, randomEl, randomDate } = require("../lib/util");

module.exports = async ({ cpf } = {}) => {
  await sleep(2);

  if (Math.random() < 0.03) {
    throw new Error("PERSONAL_INFO_SERVICE_UNAVAILABLE");
  }

  if (Math.random() < 0.05) {
    return undefined;
  }

  return {
    name: `${randomEl(names)} ${randomEl(lastNames)}`.toLowerCase(),
    birthday: randomDate(new Date("1923-01-01"), new Date("2005-01-01")),
    dead: Math.random() < 0.01 ? true : false,
  };
};
