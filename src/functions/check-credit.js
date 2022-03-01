const db = require("../db/instance");
const getPersonalInfo = require("../services/personal-info");
const getCreditInfo = require("../services/credit-info");
const { getAge } = require("../lib/util");
const { verifyCpf } = require("../lib/cpf");

const returnError = (error) => ({
  error,
});

async function getPersonalInfoOrCache(saved, cpf) {
  if (saved?.personalInfo) {
    // cached personal info
    return saved.personalInfo;
  }
  return await getPersonalInfo({ cpf }).catch(returnError);
}

async function getCreditInfoOrCache(saved, cpf, bd) {
  if (saved?.creditInfo) {
    // cached credit info
    return saved.creditInfo;
  }
  return await getCreditInfo({
    cpf,
    birthday: bd,
  }).catch(returnError);
}

function getUpToTime(debts) {
  if (debts > 800) {
    return 6;
  }
  if (debts > 600) {
    return 9;
  }
  if (debts > 400) {
    return 12;
  }
  if (debts > 200) {
    return 15;
  }
  return 18;
}

function getMonthlyInterest(score) {
  if (score > 800) {
    return 1;
  }
  if (score > 600) {
    return 2;
  }
  return 3;
}

async function checkCredit(savedResult, cpf) {
  const personalInfo = await getPersonalInfoOrCache(savedResult, cpf);

  if (!personalInfo) {
    return {
      error: { msg: "PERSONAL_INFO_NO_RESULT", scope: "getPersonalInfo" },
    };
  }

  if (personalInfo.error) {
    console.error(personalInfo.error);
    return {
      error: {
        msg: personalInfo.error.message,
        scope: "getPersonalInfo",
      },
    };
  }

  if (personalInfo.dead) {
    return {
      personalInfo,
      creditResult: {
        denied: true,
        reason: {
          msg: "IS_DEAD",
          scope: "getPersonalInfo",
          value: personalInfo.dead,
        },
      },
    };
  }

  const age = getAge(personalInfo.birthday);

  if (age < 18) {
    return {
      personalInfo,
      creditResult: {
        denied: true,
        reason: { msg: "UNDERAGE", scope: "getPersonalInfo", value: age },
      },
    };
  }

  if (age > 80) {
    return {
      personalInfo,
      creditResult: {
        denied: true,
        reason: { msg: "TOO_OLD", scope: "getPersonalInfo", value: age },
      },
    };
  }

  const creditInfo = await getCreditInfoOrCache(
    savedResult,
    cpf,
    personalInfo.birthday
  );

  if (!creditInfo) {
    return {
      personalInfo,
      error: { msg: "CREDIT_INFO_NO_RESULT", scope: "getCreditInfo" },
    };
  }

  if (creditInfo.error) {
    console.error(creditInfo.error);
    return {
      personalInfo,
      error: { msg: creditInfo.error.message, scope: "getCreditInfo" },
    };
  }

  if (creditInfo.score < 400) {
    return {
      personalInfo,
      creditInfo,
      creditResult: {
        denied: true,
        reason: {
          msg: "LOW_SCORE",
          scope: "getCreditInfo",
          value: creditInfo.score,
        },
      },
    };
  }

  if (creditInfo.totalDebts > 1000) {
    return {
      personalInfo,
      creditInfo,
      creditResult: {
        denied: true,
        reason: {
          msg: "TOTAL_DEBITS_TOO_HIGH",
          scope: "getCreditInfo",
          value: creditInfo.totalDebts,
        },
      },
    };
  }

  const upToTime = getUpToTime(creditInfo.totalDebts);

  const monthlyInterest = getMonthlyInterest(creditInfo.score);

  return {
    ...savedResult,
    personalInfo,
    creditInfo,
    creditResult: {
      denied: false,
      monthlyInterest,
      upToTime,
    },
  };
}

async function persistResult(col, savedResult, cpf, result) {
  if (!savedResult) {
    const toSave = {
      cpf,
      ...result,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    delete toSave.error;
    toSave.errors = [];
    if (result.error) toSave.errors.push({ ...result.error, date: new Date() });

    console.log("saving", toSave);
    const { insertedId } = await col.insertOne(toSave);
    console.log("new credit result", insertedId);
  } else {
    const update = {
      $set: {
        updatedAt: new Date(),
      },
    };

    if (result.personalInfo) {
      update.$set.personalInfo = result.personalInfo;
    }

    if (result.creditInfo) {
      update.$set.creditInfo = result.creditInfo;
    }

    if (result.creditResult) {
      update.$set.creditResult = result.creditResult;
    }

    if (result.error) {
      update.$push = { errors: { ...result.error, date: new Date() } };
    }

    console.log("updating", update);
    await col.updateOne({ _id: savedResult._id }, update);
    console.log("credit result updated", savedResult._id);
  }
}

module.exports = async function checkCreditAndPersist(rawcpf) {
  const { result: validation, cpf } = verifyCpf(rawcpf);
  if (validation !== "VALID") {
    return { error: { msg: validation, validation: true } };
  }

  const col = await db.getCollection("CheckCreditUser");

  const savedResult = await col.findOne({
    cpf,
  });

  if (savedResult?.creditResult) {
    return savedResult;
  }

  const result = await checkCredit(savedResult, cpf);
  console.log("checkCreditResult:", result);

  await persistResult(col, savedResult, cpf, result);

  if (result.error) {
    return { error: result.error };
  }

  return result.creditResult;
};
