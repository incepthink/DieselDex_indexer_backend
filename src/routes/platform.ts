import { Router } from "express";
import {
  getHomeData,
  getUserTransactionsByAddress,
  updateTransactionsFromIndexer,
} from "../controllers/platform";

const router = Router();

router.get("/home", getHomeData);
router.get("/user/:address", getUserTransactionsByAddress);
router.get("/transactions/update", updateTransactionsFromIndexer);

export default router;
