function verifyCpf(input) {
  const cpf = input + "";
  const cleanCpf = cpf.replace(/[^0-9]/g, "");
  if (cleanCpf.length !== 11) {
    return { result: "CPF_NOT_11_DIGITS" };
  }

  let firstSum = 0;
  for (let i = 10, j = 0; i >= 2; i--, j++) {
    const digit = parseInt(cleanCpf.charAt(j));
    firstSum += digit * i;
  }
  const firstMod = firstSum % 11;
  const firstVerifyDigit = firstMod < 2 ? 0 : 11 - firstMod;

  if (parseInt(cleanCpf[9]) !== firstVerifyDigit) {
    return { result: "INVALID_FIRST_VERIFY_DIGIT" };
  }

  let secondSum = 0;
  for (let i = 11, j = 0; i >= 2; i--, j++) {
    const digit = parseInt(cleanCpf.charAt(j));
    secondSum += digit * i;
  }
  const secondMod = secondSum % 11;
  const secondVerifyDigit = secondMod < 2 ? 0 : 11 - secondMod;

  if (parseInt(cleanCpf[10]) !== secondVerifyDigit) {
    return { result: "INVALID_SECOND_VERIFY_DIGIT" };
  }

  return { result: "VALID", cpf: cleanCpf };
}

module.exports = {
  verifyCpf,
};
