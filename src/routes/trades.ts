import { Router } from "express";
import { getTradesData } from "../controllers/trades";

const router = Router();

router.get("/", getTradesData);

export default router;
