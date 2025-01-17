import { Router } from "express";
import {
  getPools,
  getPoolsBylpId,
  getPoolAprById,
  getPoolsDb,
} from "../controllers/pool";

const router = Router();

router.get("/", getPools);
router.post("/lp", getPoolsBylpId);
router.get("/apr/:id", getPoolAprById);
router.get("/db", getPoolsDb);

export default router;
