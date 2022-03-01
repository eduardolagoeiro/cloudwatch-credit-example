const { connect, close } = require("./db/instance");
const checkCreditAndPersist = require("./functions/check-credit");

exports.handler = async (evt, ctx, cb) => {
  try {
    await connect();

    const { cpf } = JSON.parse(evt.body);
    const result = await checkCreditAndPersist(cpf);

    await close();

    return cb(null, {
      statusCode: 200,
      body: JSON.stringify(result),
    });
  } catch (error) {
    console.error(error);
    return cb(null, {
      statusCode: 500,
      body: JSON.stringify({ msg: error.message }),
    });
  }
};
