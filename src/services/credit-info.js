const { sleep, getAge } = require("../lib/util");

function randomScore(age) {
  const ageFactor = age * 10;

  const boost = Math.ceil(Math.random() * 100);
  const randomScore =
    Math.ceil(Math.random() * (1000 - ageFactor) + ageFactor) - 100;
  return boost + randomScore; // (100 - idade) * 5 + (idade - 10) * 10 + 50
}

module.exports = async ({ birthday, cpf } = {}) => {
  await sleep(4, 2);

  if (Math.random() < 0.1) {
    throw new Error("CREDIT_INFO_SERVICE_UNAVAILABLE");
  }

  if (Math.random() < 0.02) {
    return undefined;
  }

  const age = getAge(birthday);

  return {
    totalDebts: Math.random() > 0.8 ? Math.ceil(Math.random() * 550) : 0,
    score: randomScore(age),
  };
};
