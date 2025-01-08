import { Router } from "express";
import { getAssets, addAssets, getAssetById } from "../controllers/asset";

const router = Router();

router.get("/", getAssets);
router.post("/add", addAssets);
router.get("/:id", getAssetById);

export default router;
