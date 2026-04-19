import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Webhook, Trash2, Send, Copy, Check, ChevronRight, AlertCircle, CheckCircle2, Clock, Eye, EyeOff, RefreshCw, ExternalLink, Plug2 } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

const BASE = import.meta.env.BASE_URL?.replace(/\/$/, "") || "";

type WebhookRow = {
  id: number; companyId: number; name: string; url: string;
  secret: string | null; events: string[]; isActive: boolean;
  createdAt: string; updatedAt: string;
};
type Delivery = {
  id: number; webhookId: number; event: string; payload: any;
  status: string; responseStatus: number | null; responseBody: string | null;
  error: string | null; createdAt: string;
};

const EVENT_GROUPS: Record<string, { label: string; color: string; events: string[] }> = {
  billing: {
    label: "Facturation",
    color: "bg-blue-100 text-blue-800",
    events: ["invoice.created", "invoice.paid", "invoice.updated", "quote.created", "quote.accepted"],
  },
  projects: {
    label: "Projets",
    color: "bg-violet-100 text-violet-800",
    events: ["project.created", "project.updated", "project.completed", "consultation.created", "consultation.updated"],
  },
  expenses: {
    label: "Dépenses",
    color: "bg-red-100 text-red-800",
    events: ["expense.created", "expense.approved"],
  },
  hr: {
    label: "Ressources Humaines",
    color: "bg-green-100 text-green-800",
    events: ["employee.created", "employee.updated"],
  },
};

const EVENT_LABELS: Record<string, string> = {
  "invoice.created": "Facture créée",
  "invoice.paid": "Facture payée",
  "invoice.updated": "Facture modifiée",
  "quote.created": "Devis créé",
  "quote.accepted": "Devis accepté",
  "project.created": "Projet créé",
  "project.updated": "Projet modifié",
  "project.completed": "Projet terminé",
  "consultation.created": "Consultation créée",
  "consultation.updated": "Consultation modifiée",
  "expense.created": "Dépense créée",
  "expense.approved": "Dépense approuvée",
  "employee.created": "Employé ajouté",
  "employee.updated": "Employé modifié",
  "ping": "Test ping",
};

function StatusBadge({ status }: { status: string }) {
  if (status === "success") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle2 className="w-3 h-3" /> Succès</span>;
  if (status === "failed") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> Échec</span>;
  if (status === "error") return <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full"><AlertCircle className="w-3 h-3" /> Erreur</span>;
  return <span className="inline-flex items-center gap-1 text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" /> En attente</span>;
}

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="ml-1 text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

const EMPTY_FORM = { name: "", url: "", secret: "", events: [] as string[] };

export default function IntegrationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState<WebhookRow | null>(null);
  const [detailItem, setDetailItem] = useState<WebhookRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});

  const { data: webhooks = [], isLoading } = useQuery<WebhookRow[]>({
    queryKey: ["/api/webhooks"],
    queryFn: () => fetch(`${BASE}/api/webhooks`, { credentials: "include" }).then(r => r.json()),
  });

  const { data: deliveries = [], refetch: refetchDeliveries } = useQuery<Delivery[]>({
    queryKey: ["/api/webhooks", detailItem?.id, "deliveries"],
    enabled: !!detailItem,
    queryFn: () => fetch(`${BASE}/api/webhooks/${detailItem!.id}/deliveries`, { credentials: "include" }).then(r => r.json()),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["/api/webhooks"] });

  const createMutation = useMutation({
    mutationFn: () => fetch(`${BASE}/api/webhooks`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b; }),
    onSuccess: () => { invalidate(); setCreateOpen(false); setForm({ ...EMPTY_FORM }); toast({ title: "Webhook créé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: number; isActive: boolean }) =>
      fetch(`${BASE}/api/webhooks/${id}`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      }).then(async r => { if (!r.ok) throw new Error((await r.json()).error); return r.json(); }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/webhooks/${id}`, { method: "DELETE", credentials: "include" }),
    onSuccess: () => { invalidate(); setDeleteItem(null); toast({ title: "Webhook supprimé" }); },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const testMutation = useMutation({
    mutationFn: (id: number) => fetch(`${BASE}/api/webhooks/${id}/test`, {
      method: "POST", credentials: "include",
    }).then(async r => { const b = await r.json(); if (!r.ok) throw new Error(b.error); return b; }),
    onSuccess: () => {
      toast({ title: "Ping envoyé", description: "Vérifiez les livraisons pour voir le résultat." });
      if (detailItem) setTimeout(() => refetchDeliveries(), 1500);
    },
    onError: (e: Error) => toast({ title: "Erreur", description: e.message, variant: "destructive" }),
  });

  const toggleEvent = (event: string) => {
    setForm(f => ({
      ...f,
      events: f.events.includes(event) ? f.events.filter(e => e !== event) : [...f.events, event],
    }));
  };

  const toggleGroup = (events: string[]) => {
    const allSelected = events.every(e => form.events.includes(e));
    if (allSelected) {
      setForm(f => ({ ...f, events: f.events.filter(e => !events.includes(e)) }));
    } else {
      setForm(f => ({ ...f, events: [...new Set([...f.events, ...events])] }));
    }
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Intégrations</h1>
            <p className="text-muted-foreground mt-2">Connectez CTA-ONE à vos outils externes via des webhooks</p>
          </div>
          <Button onClick={() => { setForm({ ...EMPTY_FORM }); setCreateOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" /> Nouveau Webhook
          </Button>
        </div>

        {/* Info banner about Cynoia */}
        <Card className="bg-gradient-to-r from-blue-50 to-violet-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0 shadow-sm">
                <Plug2 className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900">Intégration Cynoia — À venir</h3>
                <p className="text-sm text-blue-700 mt-0.5">
                  Cynoia est une plateforme africaine tout-en-un (gestion de projets, chat, visioconférence). 
                  Dès que leur API publique sera disponible, CTA-ONE se connectera nativement.
                  En attendant, utilisez les webhooks ci-dessous avec un outil comme <strong>n8n</strong> ou <strong>Make</strong> pour automatiser vos flux.
                </p>
                <a
                  href="https://cynoia.com/en/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-1 font-medium"
                >
                  Voir Cynoia <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Webhooks list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Chargement...</div>
        ) : webhooks.length === 0 ? (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center gap-3 text-muted-foreground">
                <Webhook className="w-10 h-10 opacity-30" />
                <p className="font-medium">Aucun webhook configuré</p>
                <p className="text-sm text-center max-w-sm">
                  Ajoutez un endpoint pour recevoir des notifications en temps réel quand des événements se produisent dans CTA-ONE.
                </p>
                <Button variant="outline" onClick={() => { setForm({ ...EMPTY_FORM }); setCreateOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Créer mon premier webhook
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {webhooks.map(wh => (
              <Card key={wh.id} className={`transition-opacity ${!wh.isActive ? "opacity-60" : ""}`}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${wh.isActive ? "bg-primary/10" : "bg-muted"}`}>
                      <Webhook className={`w-5 h-5 ${wh.isActive ? "text-primary" : "text-muted-foreground"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold">{wh.name}</h3>
                        {wh.isActive
                          ? <Badge className="bg-green-100 text-green-700 text-xs">Actif</Badge>
                          : <Badge className="bg-gray-100 text-gray-600 text-xs">Inactif</Badge>}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <code className="text-xs text-muted-foreground truncate max-w-[400px]">{wh.url}</code>
                        <CopyBtn text={wh.url} />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {wh.events.length === 0
                          ? <Badge variant="outline" className="text-xs">Tous les événements</Badge>
                          : wh.events.slice(0, 5).map(e => (
                              <Badge key={e} variant="outline" className="text-xs">{EVENT_LABELS[e] ?? e}</Badge>
                            ))}
                        {wh.events.length > 5 && (
                          <Badge variant="outline" className="text-xs">+{wh.events.length - 5}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Switch
                            checked={wh.isActive}
                            onCheckedChange={v => toggleActive.mutate({ id: wh.id, isActive: v })}
                          />
                        </TooltipTrigger>
                        <TooltipContent>{wh.isActive ? "Désactiver" : "Activer"}</TooltipContent>
                      </Tooltip>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDetailItem(wh)}>
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                        onClick={() => testMutation.mutate(wh.id)} disabled={testMutation.isPending}>
                        <Send className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleteItem(wh)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Webhook payload format reference */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Format des événements</CardTitle>
            <CardDescription>Chaque webhook reçoit un payload JSON dans ce format</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted rounded-lg p-4 text-xs overflow-x-auto">{`{
  "event": "invoice.paid",
  "timestamp": "2026-01-15T10:30:00.000Z",
  "data": {
    "id": 42,
    "number": "FAC-2026-042",
    "amount": 125000,
    "currency": "MRU",
    "clientName": "Société BMCI Mauritanie",
    ...
  }
}`}</pre>
            <p className="text-xs text-muted-foreground mt-3">
              Chaque requête inclut l'en-tête <code className="bg-muted px-1 rounded">X-CTA-Signature</code> pour vérifier l'authenticité (HMAC-SHA256 avec votre secret).
            </p>
          </CardContent>
        </Card>

        {/* Create dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Webhook className="w-5 h-5" /> Nouveau Webhook</DialogTitle>
            </DialogHeader>
            <form onSubmit={e => { e.preventDefault(); createMutation.mutate(); }} className="space-y-5">
              <div>
                <Label>Nom *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Synchronisation Cynoia" required />
              </div>
              <div>
                <Label>URL endpoint *</Label>
                <Input type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
                  placeholder="https://hooks.example.com/cta-one" required />
              </div>
              <div>
                <Label>Secret de signature</Label>
                <Input value={form.secret} onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                  placeholder="Laissez vide pour générer automatiquement" />
                <p className="text-xs text-muted-foreground mt-1">Utilisé pour vérifier l'authenticité des requêtes (HMAC-SHA256)</p>
              </div>
              <div>
                <Label className="mb-3 block">Événements à écouter</Label>
                <p className="text-xs text-muted-foreground mb-3">Laissez tout décoché pour recevoir tous les événements.</p>
                <div className="space-y-4">
                  {Object.entries(EVENT_GROUPS).map(([key, group]) => {
                    const allSelected = group.events.every(e => form.events.includes(e));
                    const someSelected = group.events.some(e => form.events.includes(e));
                    return (
                      <div key={key} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Checkbox
                              id={`group-${key}`}
                              checked={allSelected}
                              data-state={someSelected && !allSelected ? "indeterminate" : undefined}
                              onCheckedChange={() => toggleGroup(group.events)}
                            />
                            <label htmlFor={`group-${key}`} className="text-sm font-medium cursor-pointer">
                              <Badge className={group.color + " text-xs"}>{group.label}</Badge>
                            </label>
                          </div>
                          <span className="text-xs text-muted-foreground">{group.events.filter(e => form.events.includes(e)).length}/{group.events.length}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 pl-6">
                          {group.events.map(event => (
                            <div key={event} className="flex items-center gap-2">
                              <Checkbox id={event} checked={form.events.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                              <label htmlFor={event} className="text-xs cursor-pointer text-muted-foreground">{EVENT_LABELS[event]}</label>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Annuler</Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? "Création..." : "Créer le webhook"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Detail / deliveries dialog */}
        <Dialog open={!!detailItem} onOpenChange={open => { if (!open) setDetailItem(null); }}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Webhook className="w-4 h-4" /> {detailItem?.name}
              </DialogTitle>
            </DialogHeader>
            {detailItem && (
              <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
                <TabsList className="shrink-0">
                  <TabsTrigger value="details">Détails</TabsTrigger>
                  <TabsTrigger value="deliveries">Livraisons récentes</TabsTrigger>
                </TabsList>
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid gap-3">
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">URL</p>
                      <div className="flex items-center gap-1 mt-1">
                        <code className="text-sm break-all">{detailItem.url}</code>
                        <CopyBtn text={detailItem.url} />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Secret</p>
                      <div className="flex items-center gap-2 mt-1">
                        <code className="text-sm font-mono">
                          {showSecret[detailItem.id] ? detailItem.secret : "••••••••••••••••"}
                        </code>
                        <button onClick={() => setShowSecret(s => ({ ...s, [detailItem.id]: !s[detailItem.id] }))}
                          className="text-muted-foreground hover:text-foreground">
                          {showSecret[detailItem.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                        {detailItem.secret && <CopyBtn text={detailItem.secret} />}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Événements</p>
                      <div className="flex flex-wrap gap-1">
                        {detailItem.events.length === 0
                          ? <Badge variant="outline">Tous les événements</Badge>
                          : detailItem.events.map(e => <Badge key={e} variant="outline" className="text-xs">{EVENT_LABELS[e] ?? e}</Badge>)}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Créé le</p>
                      <p className="text-sm mt-1">{format(new Date(detailItem.createdAt), "dd MMMM yyyy à HH:mm", { locale: fr })}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => testMutation.mutate(detailItem.id)} disabled={testMutation.isPending}>
                      <Send className="w-3.5 h-3.5 mr-2" /> Envoyer un ping test
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="deliveries" className="flex-1 overflow-hidden flex flex-col mt-4">
                  <div className="flex justify-between items-center mb-3">
                    <p className="text-sm text-muted-foreground">{deliveries.length} livraison(s) récente(s)</p>
                    <Button variant="ghost" size="sm" onClick={() => refetchDeliveries()}>
                      <RefreshCw className="w-3.5 h-3.5 mr-1" /> Actualiser
                    </Button>
                  </div>
                  <ScrollArea className="flex-1">
                    {deliveries.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">Aucune livraison pour ce webhook</div>
                    ) : (
                      <div className="space-y-2">
                        {deliveries.map(d => (
                          <div key={d.id} className="border rounded-lg p-3 text-sm">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <StatusBadge status={d.status} />
                                <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{d.event}</code>
                                {d.responseStatus && <span className="text-xs text-muted-foreground">HTTP {d.responseStatus}</span>}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(d.createdAt), "dd/MM à HH:mm:ss")}
                              </span>
                            </div>
                            {d.error && <p className="text-xs text-red-600 mt-1 font-mono">{d.error}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* Delete confirm */}
        <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer ce webhook ?</AlertDialogTitle>
              <AlertDialogDescription>
                <strong>{deleteItem?.name}</strong> sera supprimé définitivement avec tout son historique de livraisons.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => deleteItem && deleteMutation.mutate(deleteItem.id)}
              >
                Supprimer
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  );
}
