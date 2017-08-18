const production_settings = {
  db: 'mongodb://fraser:mongopass@ds129023.mlab.com:29023/heroku_163rlf26',
};

const dev_settings = {
  db: 'mongodb://localhost:27017/cache',
};

function Config() {
  switch (process.env.NODE_ENV) {
    case 'production':
      return production_settings;
    default:
      return production_settings;
  }
}

module.exports = Config();
