import { Application } from "express";
import poolRouter from "./pool";
import assetRouter from "./asset";
import routingRouter from "./findRoute";
import botRouter from "./botRoutes";
import platformRouter from "./platform";
import tradesRouter from "./trades";

const initializeRoutes = (app: Application) => {
  app.use("/pools", poolRouter);
  app.use("/assets", assetRouter);
  app.use("/route", routingRouter);
  app.use("/bot", botRouter);
  app.use("/platform", platformRouter);
  app.use("/trades", tradesRouter);
};

export default initializeRoutes;
