const config = {
  development: {
    username: "root",
    password:"Shoaib2580",
    database: "indexer",
    host: "127.0.0.1",
    port:3306,
    dialect: "mysql",
    logging: false
  },
  production: {
    username: "admin",
    password: process.env.DB_PASSWORD ,
    database:  "indexer",
    host: process.env.DB_HOST,
    port:3306,
    dialect: "mysql",
    logging: false
  }
};

export default config