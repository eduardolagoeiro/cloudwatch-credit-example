const { MongoClient } = require("mongodb");

const url = process.env.DATABASE_URL ?? "mongodb://localhost:27017/credit-db";

let instance;

module.exports = {
  async connect() {
    console.log("connecting to ", url);
    instance = { client: new MongoClient(url) };
    await instance.client.connect();
    instance.db = instance.client.db();
  },

  async close() {
    if (!instance) return;
    await instance.client.close();
    instance = undefined;
  },

  async getCollection(col) {
    if (!instance) {
      await this.connect();
    }

    return instance.db.collection(col);
  },
};
