const db = require("../db/instance");
const getPersonalInfo = require("../services/personal-info");
const getCreditInfo = require("../services/credit-info");
const { getAge } = require("../lib/util");
const { verifyCpf } = require("../lib/cpf");
const timer = require("../lib/timer");
const { Unit } = require("aws-embedded-metrics");

const returnError = (error) => ({
  error,
});

async function getPersonalInfoOrCache(saved, cpf, metrics) {
  if (saved?.personalInfo) return saved.personalInfo;

  const { time } = timer.create();

  const result = await getPersonalInfo({ cpf }).catch(returnError);

  if (result?.error) {
    metrics.putMetric("sv_unavailable", 1);
  }

  metrics.putMetric("sv_personal_info_duration", time(), Unit.Milliseconds);

  return result;
}

async function getCreditInfoOrCache(saved, cpf, bd, metrics) {
  if (saved?.creditInfo) return saved.creditInfo;

  const { time } = timer.create();

  const result = await getCreditInfo({
    cpf,
    birthday: bd,
  }).catch(returnError);

  if (result?.error) {
    metrics.putMetric("sv_unavailable", 1);
  }

  metrics.putMetric("sv_credit_info_duration", time(), Unit.Milliseconds);

  return result;
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

async function checkCredit(savedResult, cpf, metrics) {
  const personalInfo = await getPersonalInfoOrCache(savedResult, cpf, metrics);

  if (!personalInfo) {
    return {
      error: { msg: "PERSONAL_INFO_NO_RESULT", scope: "getPersonalInfo" },
    };
  }

  if (personalInfo.error) {
    metrics.setProperty("is_sv_unavailable", true);
    metrics.setProperty("sv_unavailable_name", "personal_info");
    metrics.setProperty("check_credit_error_stack", personalInfo.error.stack);
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

  const creditInfo = await getCreditInfoOrCache(savedResult, cpf, personalInfo.birthday, metrics);

  if (!creditInfo) {
    return {
      personalInfo,
      error: { msg: "CREDIT_INFO_NO_RESULT", scope: "getCreditInfo" },
    };
  }

  if (creditInfo.error) {
    metrics.setProperty("is_sv_unavailable", true);
    metrics.setProperty("sv_unavailable_name", "credit_info");
    metrics.setProperty("check_credit_error_stack", creditInfo.error.stack);
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

    const { insertedId } = await col.insertOne(toSave);
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

    await col.updateOne({ _id: savedResult._id }, update);
  }
}

module.exports = async function checkCreditAndPersist(rawcpf, metrics) {
  const { result: validation, cpf } = verifyCpf(rawcpf);
  if (validation !== "VALID") {
    return { error: { msg: validation, validation: true } };
  }

  metrics.putMetric("valid_calls", 1);
  metrics.setProperty("cpf", cpf);

  const col = await db.getCollection("CheckCreditUser");

  const savedResult = await col.findOne({
    cpf,
  });

  if (savedResult?.creditResult) {
    metrics.putMetric("cached_calls", 1);
    metrics.setProperty("personal_info", savedResult.personalInfo);
    metrics.setProperty("credit_info", savedResult.creditInfo);
    metrics.setProperty("credit_result", savedResult.creditResult);
    return savedResult;
  }

  if (savedResult) metrics.putMetric("retry_calls", 1);
  metrics.putMetric("new_calls", 1);

  const result = await checkCredit(savedResult, cpf, metrics);

  if (result.personalInfo) metrics.setProperty("personal_info", result.personalInfo);
  if (result.creditInfo) metrics.setProperty("credit_info", result.creditInfo);
  if (result.creditResult) metrics.setProperty("credit_result", result.creditResult);

  const isDenied = result?.creditResult?.denied;

  if (isDenied === true) {
    metrics.putMetric("denied", 1);
  }

  if (isDenied === false) {
    metrics.putMetric("approved", 1);
    metrics.putMetric("monthly_interest", result.creditResult.monthlyInterest);
  }

  await persistResult(col, savedResult, cpf, result);

  if (result.error) {
    metrics.setProperty("check_credit_error", result.error);
    return { error: result.error };
  }

  return result.creditResult;
};
