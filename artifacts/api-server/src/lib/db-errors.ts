import { type Response } from "express";

const FK_VIOLATION = "23503";
const UNIQUE_VIOLATION = "23505";
const NOT_NULL_VIOLATION = "23502";

function getPgCode(err: unknown): string | undefined {
  const e = err as any;
  return e?.code ?? e?.cause?.code ?? e?.original?.code;
}

const ENTITY_LABELS: Record<string, { fr: string; usedBy?: string }> = {
  product: { fr: "ce produit/service", usedBy: "des devis, proformas ou factures" },
  partner: { fr: "ce tiers", usedBy: "des devis, factures, projets ou consultations" },
  department: { fr: "ce département", usedBy: "des employés ou postes" },
  position: { fr: "ce poste", usedBy: "des employés" },
  employee: { fr: "cet employé", usedBy: "des contrats, congés, présences ou projets" },
  expense_type: { fr: "ce type de dépense", usedBy: "des dépenses existantes" },
  expense: { fr: "cette dépense" },
  leave_type: { fr: "ce type de congé", usedBy: "des demandes de congé" },
  project_service_type: { fr: "ce type de service", usedBy: "des projets ou consultations" },
  project_consultation_type: { fr: "ce type de consultation", usedBy: "des consultations" },
  project: { fr: "ce projet", usedBy: "des sites, rapports ou factures" },
  consultation: { fr: "cette consultation", usedBy: "des projets liés" },
  invoice: { fr: "cette facture", usedBy: "des paiements" },
  quote: { fr: "ce devis" },
  proforma: { fr: "ce proforma" },
  user: { fr: "cet utilisateur" },
  role: { fr: "ce rôle", usedBy: "des utilisateurs" },
  webhook: { fr: "ce webhook" },
};

export function handleDbError(err: unknown, res: Response, entity: string): boolean {
  const code = getPgCode(err);
  const label = ENTITY_LABELS[entity] ?? { fr: "cet élément" };

  if (code === FK_VIOLATION) {
    const usedBy = label.usedBy ? ` Il est lié à ${label.usedBy}.` : "";
    res.status(409).json({
      error: `Impossible de supprimer ${label.fr} car il est utilisé ailleurs dans le système.${usedBy} Désactivez-le ou supprimez d'abord les éléments associés.`,
      code: "FK_VIOLATION",
    });
    return true;
  }

  if (code === UNIQUE_VIOLATION) {
    res.status(409).json({
      error: `Cet élément existe déjà (doublon détecté). Vérifiez les champs uniques comme le nom, le code ou l'identifiant.`,
      code: "UNIQUE_VIOLATION",
    });
    return true;
  }

  if (code === NOT_NULL_VIOLATION) {
    res.status(400).json({
      error: `Un champ obligatoire est manquant.`,
      code: "NOT_NULL_VIOLATION",
    });
    return true;
  }

  return false;
}
