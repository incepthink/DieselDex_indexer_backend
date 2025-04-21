import { Router } from "express";
import {
  getAssets,
  addAssets,
  getAssetById,
  getExchangeRateByAssetId,
  getAssetPriceByID,
  getAssetSupplyByID,
  getAssetsFromDB,
} from "../controllers/asset";

const router = Router();

router.get("/", getAssets);
router.post("/add", addAssets);
router.post("/exchangeRate", getExchangeRateByAssetId);
router.get("/price/:address", getAssetPriceByID);
router.get("/supply/:address", getAssetSupplyByID);
router.get("/db", getAssetsFromDB);
router.get("/db/:assetId", getAssetById);

export default router;
