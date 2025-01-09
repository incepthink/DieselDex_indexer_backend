import { Router } from "express";
import { getPools, getPoolSnapshotsById, getPoolsBylpId } from "../controllers/pool";

const router = Router();

router.get("/", getPools);
// router.get("/:id", getPoolSnapshotsById);
router.post('/lp', getPoolsBylpId)

export default router;
