import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Paperclip, Upload, Link2, FileText, Image, File, Trash2, Download,
  ExternalLink, Plus, X,
} from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${BASE}${path}`, { credentials: "include", ...opts });
  const body = await r.json();
  if (!r.ok) throw new Error(body.error || "Erreur serveur");
  return body;
}

interface Attachment {
  id: number;
  name: string;
  originalName: string;
  contentType: string;
  size: number;
  objectPath?: string;
  externalUrl?: string;
  category: string;
  createdAt: string;
}

function fileIcon(contentType: string, category: string) {
  if (category === "lien") return <Link2 className="w-4 h-4 text-blue-500" />;
  if (contentType.startsWith("image/")) return <Image className="w-4 h-4 text-purple-500" />;
  if (contentType === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  if (contentType.includes("word") || contentType.includes("document")) return <FileText className="w-4 h-4 text-blue-600" />;
  if (contentType.includes("sheet") || contentType.includes("excel")) return <FileText className="w-4 h-4 text-green-600" />;
  return <File className="w-4 h-4 text-gray-500" />;
}

function formatSize(bytes: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

interface Props {
  entityType: "consultation" | "project" | "report";
  entityId: number;
}

export function AttachmentsPanel({ entityType, entityId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [mode, setMode] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const queryKey = ["attachments", entityType, entityId];

  const { data: attachments = [] } = useQuery<Attachment[]>({
    queryKey,
    queryFn: () => apiFetch(`${BASE}/api/attachments/${entityType}/${entityId}`),
  });

  // ── Uploader un fichier via URL présignée GCS ─────────────────────────────
  async function handleFileUpload(file: File) {
    setUploading(true);
    setUploadProgress(0);
    try {
      // Étape 1 : demander l'URL présignée
      const { uploadURL, objectPath } = await apiFetch(`${BASE}/api/storage/uploads/request-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });

      // Étape 2 : upload direct vers GCS
      setUploadProgress(30);
      const gcsResp = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!gcsResp.ok) throw new Error("Échec de l'upload vers le stockage");

      setUploadProgress(80);

      // Étape 3 : enregistrer les métadonnées
      await apiFetch(`${BASE}/api/attachments/${entityType}/${entityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          originalName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          objectPath,
          category: file.type.startsWith("image/") ? "image" : "document",
        }),
      });

      setUploadProgress(100);
      toast({ title: `"${file.name}" ajouté` });
      qc.invalidateQueries({ queryKey });
      setAddOpen(false);
    } catch (e: any) {
      toast({ title: "Erreur upload", description: e.message, variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  }

  // ── Ajouter un lien externe ────────────────────────────────────────────────
  async function handleAddLink() {
    if (!linkUrl.trim()) return;
    try {
      await apiFetch(`${BASE}/api/attachments/${entityType}/${entityId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: linkName || linkUrl,
          originalName: linkName || linkUrl,
          contentType: "text/uri-list",
          size: 0,
          externalUrl: linkUrl,
          category: "lien",
        }),
      });
      toast({ title: "Lien ajouté" });
      qc.invalidateQueries({ queryKey });
      setLinkUrl("");
      setLinkName("");
      setAddOpen(false);
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  }

  // ── Supprimer ──────────────────────────────────────────────────────────────
  async function handleDelete(id: number, name: string) {
    if (!confirm(`Supprimer "${name}" ?`)) return;
    try {
      await apiFetch(`${BASE}/api/attachments/${id}`, { method: "DELETE" });
      toast({ title: "Supprimé" });
      qc.invalidateQueries({ queryKey });
    } catch (e: any) {
      toast({ title: "Erreur", description: e.message, variant: "destructive" });
    }
  }

  // ── Télécharger / ouvrir ───────────────────────────────────────────────────
  function handleOpen(att: Attachment) {
    if (att.externalUrl) {
      window.open(att.externalUrl, "_blank", "noopener");
    } else if (att.objectPath) {
      window.open(`${BASE}/api/storage${att.objectPath}`, "_blank");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5 text-muted-foreground uppercase tracking-wide">
          <Paperclip className="w-4 h-4" /> Pièces jointes
          {attachments.length > 0 && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-xs font-normal">{attachments.length}</span>
          )}
        </h3>
        <Button variant="outline" size="sm" onClick={() => { setMode("file"); setAddOpen(true); }} className="gap-1.5 h-7 text-xs">
          <Plus className="w-3 h-3" /> Ajouter
        </Button>
      </div>

      {attachments.length === 0 ? (
        <div className="border-2 border-dashed rounded-lg p-4 text-center">
          <p className="text-xs text-muted-foreground">Aucune pièce jointe</p>
          <div className="flex justify-center gap-2 mt-2">
            <Button variant="ghost" size="sm" onClick={() => { setMode("file"); setAddOpen(true); }} className="gap-1.5 text-xs h-7">
              <Upload className="w-3 h-3" /> Fichier
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setMode("link"); setAddOpen(true); }} className="gap-1.5 text-xs h-7">
              <Link2 className="w-3 h-3" /> Lien
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id}
              className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 bg-muted/30 hover:bg-muted/60 group transition-colors">
              <span className="flex-shrink-0">{fileIcon(att.contentType, att.category)}</span>
              <button
                className="flex-1 text-left min-w-0 cursor-pointer"
                onClick={() => handleOpen(att)}
                title={att.category === "lien" ? att.externalUrl : att.originalName}
              >
                <p className="text-sm font-medium truncate">{att.name}</p>
                <p className="text-xs text-muted-foreground">
                  {att.category === "lien" ? "Lien externe" : formatSize(att.size)}
                  {" · "}
                  {format(new Date(att.createdAt), "dd MMM yyyy", { locale: fr })}
                </p>
              </button>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {att.category !== "lien" && att.objectPath && (
                  <button
                    onClick={() => handleOpen(att)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Télécharger"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                )}
                {att.category === "lien" && (
                  <button
                    onClick={() => handleOpen(att)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                    title="Ouvrir le lien"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => handleDelete(att.id, att.name)}
                  className="p-1 rounded hover:bg-red-100 text-muted-foreground hover:text-red-600"
                  title="Supprimer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog d'ajout */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajouter une pièce jointe</DialogTitle>
          </DialogHeader>

          {/* Onglets Fichier / Lien */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setMode("file")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${mode === "file" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Upload className="w-3.5 h-3.5" /> Fichier
            </button>
            <button
              onClick={() => setMode("link")}
              className={`flex-1 flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors
                ${mode === "link" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Link2 className="w-3.5 h-3.5" /> Lien externe
            </button>
          </div>

          {mode === "file" ? (
            <div className="space-y-3">
              <div
                className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) handleFileUpload(file);
                }}
              >
                <Upload className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium">Cliquer ou glisser-déposer</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, Word, Excel, Images, etc.</p>
                {uploading && (
                  <div className="mt-3">
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Upload en cours... {uploadProgress}%</p>
                  </div>
                )}
              </div>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp,.mp4,.zip,.rar"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                  e.target.value = "";
                }}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>URL du lien *</Label>
                <Input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                />
              </div>
              <div>
                <Label>Nom affiché</Label>
                <Input
                  value={linkName}
                  onChange={e => setLinkName(e.target.value)}
                  placeholder="Ex: TDR projet, Note technique..."
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAddOpen(false)}>Annuler</Button>
                <Button onClick={handleAddLink} disabled={!linkUrl.trim()}>Ajouter le lien</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
