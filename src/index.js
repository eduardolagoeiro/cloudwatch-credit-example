const { createMetricsLogger, Unit } = require("aws-embedded-metrics");
const { connect, close } = require("./db/instance");
const checkCreditAndPersist = require("./functions/check-credit");
const timer = require("./lib/timer");

function now() {
  return new Date();
}

exports.handler = async (evt, ctx, cb) => {
  const metrics = createMetricsLogger();
  const { time } = timer.create();

  metrics.putDimensions({ Service: "CHECK-CREDIT" });
  metrics.putMetric("total_calls", 1);

  try {
    await connect();

    const { cpf } = JSON.parse(evt.body);
    const result = await checkCreditAndPersist(cpf, metrics);

    await close();

    metrics.putMetric("duration", time(), Unit.Milliseconds);

    if (result?.error?.validation) {
      return cb(null, {
        statusCode: 422,
        body: JSON.stringify(result),
      });
    }

    if (result?.error) {
      return cb(null, {
        statusCode: 503,
        body: JSON.stringify(result),
      });
    }

    return cb(null, {
      statusCode: 200,
      body: JSON.stringify(result),
    });
  } catch (error) {
    metrics.putMetric("error", 1);
    metrics.setProperty("error_stack", error.stack);

    return cb(null, {
      statusCode: 500,
      body: JSON.stringify({ msg: error.message }),
    });
  } finally {
    await metrics.flush();
  }
};
