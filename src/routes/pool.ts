import { Router } from "express";
import { getPools, getPoolsBylpId, getPoolAprById } from "../controllers/pool";

const router = Router();

router.get("/", getPools);
router.post("/lp", getPoolsBylpId);
router.get("/apr/:id", getPoolAprById);

export default router;
