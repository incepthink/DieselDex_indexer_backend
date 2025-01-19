import { Router } from "express";
import { sendDataToBot } from "../controllers/bot";

const router = Router();

router.post("/message", sendDataToBot);

export default router;
