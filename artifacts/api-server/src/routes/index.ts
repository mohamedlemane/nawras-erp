import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import companiesRouter from "./companies";
import usersRouter from "./users";
import rolesRouter from "./roles";
import partnersRouter from "./partners";
import productsRouter from "./products";
import billingRouter from "./billing";
import hrRouter from "./hr";
import dashboardRouter from "./dashboard";
import auditRouter from "./audit";
import projectsRouter from "./projects";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(companiesRouter);
router.use(usersRouter);
router.use(rolesRouter);
router.use(partnersRouter);
router.use(productsRouter);
router.use(billingRouter);
router.use(hrRouter);
router.use(dashboardRouter);
router.use(auditRouter);
router.use(projectsRouter);

export default router;
