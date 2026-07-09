import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import usersRouter from "./users";
import promptsRouter from "./prompts";
import librariesRouter from "./libraries";
import statsRouter from "./stats";

const router: IRouter = Router();

router.use(healthRouter);
router.use(categoriesRouter);
router.use(usersRouter);
router.use(promptsRouter);
router.use(librariesRouter);
router.use(statsRouter);

export default router;
