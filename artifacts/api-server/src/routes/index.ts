import { Router, type IRouter } from "express";
import authRouter from "./auth";
import callsRouter from "./calls";
import contactsRouter from "./contacts";
import conversationsRouter from "./conversations";
import devicesRouter from "./devices";
import e2eRouter from "./e2e";
import emojisRouter from "./emojis";
import healthRouter from "./health";
import mediaRouter from "./media";
import metadataRouter from "./metadata";
import meRouter from "./me";
import storiesRouter from "./stories";
import usersRouter from "./users";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(meRouter);
router.use(usersRouter);
router.use(conversationsRouter);
router.use(callsRouter);
router.use(contactsRouter);
router.use(devicesRouter);
router.use(e2eRouter);
router.use(emojisRouter);
router.use(mediaRouter);
router.use(metadataRouter);
router.use(storiesRouter);

export default router;
