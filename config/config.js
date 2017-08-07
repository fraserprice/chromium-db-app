const production_settings = {
  db: 'mongodb://heroku_vzb7wml5:5i62a359dvp93i581b3c3316b4@ds143201.mlab.com:43201/heroku_vzb7wml5',
};

const dev_settings = {
  db: 'mongodb://localhost:27017/cache',
};

function Config() {
  switch (process.env.NODE_ENV) {
    case 'production':
      return production_settings;
    default:
      return dev_settings;
  }
}

module.exports = Config;
