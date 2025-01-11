import { Application } from "express";
import poolRouter from "./pool";
import assetRouter from "./asset";
import routingRouter from "./findRoute";

const initializeRoutes = (app: Application) => {
  app.use("/pools", poolRouter);
  app.use("/assets", assetRouter);
  app.use("/route", routingRouter);
};

export default initializeRoutes;
