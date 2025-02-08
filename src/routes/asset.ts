import { Router } from "express";
import {
  getAssets,
  addAssets,
  getAssetById,
  getExchangeRateByAssetId,
  getAssetPriceByID,
  getAssetSupplyByID,
} from "../controllers/asset";

const router = Router();

router.get("/", getAssets);
router.post("/add", addAssets);
// router.get("/:id", getAssetById);
router.post("/exchangeRate", getExchangeRateByAssetId);
router.get("/price/:address", getAssetPriceByID);
router.get("/supply/:address", getAssetSupplyByID);

export default router;
