const moment = require("moment");

module.exports = {
  sleep(max = 10, min) {
    if (!min) {
      min = (max * 2) / 3;
    }

    return new Promise((resolve) => {
      const timeout = Math.random() * (max - min) * 1000 + min * 1000;
      setTimeout(() => {
        resolve();
      }, timeout);
    });
  },

  randomDate(start, end) {
    return new Date(
      start.getTime() + Math.random() * (end.getTime() - start.getTime())
    );
  },

  randomEl(arr) {
    return arr[Math.floor(arr.length * Math.random())];
  },

  getAge(bd) {
    return moment().diff(bd, "years");
  },
};
