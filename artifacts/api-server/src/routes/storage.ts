import { Router, type IRouter, type Request, type Response } from "express";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";
import { requireAuth } from "../lib/rbac";

const router: IRouter = Router();
const objectStorage = new ObjectStorageService();

/**
 * POST /storage/uploads/request-url
 * Retourne une URL présignée GCS pour upload direct depuis le client.
 * Body: { name, size, contentType }
 * Response: { uploadURL, objectPath, metadata }
 */
router.post("/storage/uploads/request-url", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const { name, size, contentType } = req.body;
  if (!name || !contentType) {
    res.status(400).json({ error: "name et contentType requis" });
    return;
  }
  try {
    const uploadURL = await objectStorage.getObjectEntityUploadURL();
    const objectPath = objectStorage.normalizeObjectEntityPath(uploadURL);
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (err: any) {
    req.log?.error({ err }, "storage upload url error");
    res.status(500).json({ error: "Erreur lors de la génération de l'URL d'upload" });
  }
});

/**
 * GET /storage/objects/*
 * Sert un fichier depuis le stockage privé.
 */
router.get(/^\/storage\/objects\/(.+)$/, requireAuth, async (req: Request, res: Response): Promise<void> => {
  const objectPath = "/objects/" + (req.params as any)[0];
  try {
    const file = await objectStorage.getObjectEntityFile(objectPath);
    const response = await objectStorage.downloadObject(file);
    const headers = Object.fromEntries(response.headers.entries());
    res.set(headers);
    const buf = Buffer.from(await response.arrayBuffer());
    res.send(buf);
  } catch (err: any) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Fichier introuvable" });
    } else {
      req.log?.error({ err }, "storage serve error");
      res.status(500).json({ error: "Erreur lors de la lecture du fichier" });
    }
  }
});

export default router;
