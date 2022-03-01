module.exports = {
  create() {
    let init = new Date();
    return {
      time() {
        const end = new Date();
        return end.getTime() - init.getTime();
      },
    };
  },
};
