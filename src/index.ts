import express, { NextFunction, Request, Response, Express } from "express";
import cors, { CorsOptions } from "cors";
import dotenv from "dotenv";
import initializeRoutes from "./routes";
import { CustomError } from "./utils/error_factory";
import sequelize from "./models";
import { Client, cacheExchange, fetchExchange } from "@urql/core";

export const client = new Client({
  url: "https://indexer.dev.hyperindex.xyz/4f8ab9e/v1/graphql",
  exchanges: [cacheExchange, fetchExchange],
});

dotenv.config();
const app: Express = express();

const port = 5000;

const corsOptions: CorsOptions = {
  origin: "*",
  optionsSuccessStatus: 200,
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Accept",
    "Origin",
    "x-api-key",
  ],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req: Request, res: Response) => {
  res.send("Hello World");
});

initializeRoutes(app);

app.use((err: CustomError, req: Request, res: Response, next: NextFunction) => {
  console.error(err.details?.context, err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message,
    details: err.details,
  });
  next();
});

const server = app.listen(port, async () => {
  try {
    await sequelize.authenticate();
    await sequelize.sync();
    console.info("⚡️[server]: Server is running at http://localhost:", port);
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
});

export default app;
export { server };
