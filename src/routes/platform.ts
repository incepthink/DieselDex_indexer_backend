import { Router } from "express";
import { getHomeData } from "../controllers/platform";

const router = Router();

router.get("/home", getHomeData);

export default router;
