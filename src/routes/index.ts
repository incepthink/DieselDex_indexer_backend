import { Application } from "express";
import poolRouter from "./pool";
import assetRouter from "./asset";

const initializeRoutes = (app: Application) => {
  app.use("/pools", poolRouter);
  app.use("/assets", assetRouter);
};

export default initializeRoutes;
