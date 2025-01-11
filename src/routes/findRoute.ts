import { Router } from "express";
import { getSwapRoute } from "../controllers/findRoute";

const router = Router();

router.post("/get_route", getSwapRoute);

export default router;
