import { Router } from "express";
import {
  getAssets,
  addAssets,
  getAssetById,
  getExchangeRateByAssetId,
} from "../controllers/asset";

const router = Router();

router.get("/", getAssets);
router.post("/add", addAssets);
router.get("/:id", getAssetById);
router.post("/exchangeRate", getExchangeRateByAssetId);

export default router;
