import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import subcategoriesRouter from "./subcategories";
import usersRouter from "./users";
import promptsRouter from "./prompts";
import librariesRouter from "./libraries";
import statsRouter from "./stats";
import accessRouter from "./access";
import firmsRouter from "./firms";
import storageRouter from "./storage";
import settingsRouter from "./settings";
import agentRouter from "./agent";
import mcpRouter from "./mcp";
import ratingsRouter from "./ratings";
import analyticsRouter from "./analytics";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(subcategoriesRouter);
router.use(usersRouter);
router.use(promptsRouter);
router.use(librariesRouter);
router.use(statsRouter);
router.use(accessRouter);
router.use(firmsRouter);
router.use(storageRouter);
router.use(settingsRouter);
router.use(agentRouter);
router.use(mcpRouter);
router.use(ratingsRouter);
router.use(analyticsRouter);

export default router;
