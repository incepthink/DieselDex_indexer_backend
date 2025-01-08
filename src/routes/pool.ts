import { Router } from "express";
import { getPools, getPoolSnapshotsById } from "../controllers/pool";

const router = Router();

router.get("/", getPools);
router.get("/:id", getPoolSnapshotsById);

export default router;
