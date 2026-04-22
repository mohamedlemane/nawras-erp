import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useGetMyCompany, updateMyCompany } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, Banknote, MapPin, Upload, Save, X, Coins } from "lucide-react";
import { CURRENCIES } from "@/lib/currencies";

export default function CompanySettings() {
  const queryClient = useQueryClient();
  const { data: company, isLoading } = useGetMyCompany();
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: "",
    legalName: "",
    taxNumber: "",
    registrationNumber: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    country: "Mauritanie",
    logo: "",
    bankName: "",
    bankCode: "",
    branchCode: "",
    accountNumber: "",
    ribKey: "",
    rib: "",
    swiftCode: "",
    currency: "MRU",
  });

  useEffect(() => {
    if (company) {
      setForm({
        name: company.name ?? "",
        legalName: company.legalName ?? "",
        taxNumber: company.taxNumber ?? "",
        registrationNumber: company.registrationNumber ?? "",
        email: company.email ?? "",
        phone: company.phone ?? "",
        address: company.address ?? "",
        city: company.city ?? "",
        country: company.country ?? "Mauritanie",
        logo: company.logo ?? "",
        bankName: company.bankName ?? "",
        bankCode: company.bankCode ?? "",
        branchCode: company.branchCode ?? "",
        accountNumber: company.accountNumber ?? "",
        ribKey: company.ribKey ?? "",
        rib: company.rib ?? "",
        swiftCode: company.swiftCode ?? "",
        currency: company.currency ?? "MRU",
      });
    }
  }, [company]);

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setSuccess(false);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert("Le logo doit être inférieur à 5 Mo.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 400;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d")!;
        ctx.drawImage(img, 0, 0, w, h);
        const compressed = canvas.toDataURL("image/jpeg", 0.8);
        setForm((prev) => ({ ...prev, logo: compressed }));
        setSuccess(false);
      };
      img.src = ev.target!.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateMyCompany({
        name: form.name,
        legalName: form.legalName || null,
        taxNumber: form.taxNumber || null,
        registrationNumber: form.registrationNumber || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        country: form.country || null,
        logo: form.logo || null,
        bankName: form.bankName || null,
        bankCode: form.bankCode || null,
        branchCode: form.branchCode || null,
        accountNumber: form.accountNumber || null,
        ribKey: form.ribKey || null,
        rib: form.rib || null,
        swiftCode: form.swiftCode || null,
        currency: form.currency || "MRU",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/companies/mine"] });
      setSuccess(true);
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Chargement…</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Paramètres de l'entreprise</h1>
        <p className="text-muted-foreground mt-1">
          Configurez les informations de votre entreprise. Ces données apparaîtront sur vos documents commerciaux.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">

        {/* LOGO + Informations générales */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Informations générales
            </CardTitle>
            <CardDescription>Identité légale et coordonnées de l'entreprise</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Logo */}
            <div className="flex items-start gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="h-20 w-20 rounded-lg border-2 border-dashed border-muted-foreground/30 flex items-center justify-center bg-muted/30 overflow-hidden">
                  {form.logo ? (
                    <img src={form.logo} alt="Logo" className="h-full w-full object-contain" />
                  ) : (
                    <Building2 className="h-8 w-8 text-muted-foreground/40" />
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-xs h-7"
                  >
                    <Upload className="h-3 w-3 mr-1" />
                    Logo
                  </Button>
                  {form.logo && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setForm((p) => ({ ...p, logo: "" }))}
                      className="text-xs h-7 text-destructive hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoChange}
                />
                <span className="text-xs text-muted-foreground">Max 500 Ko</span>
              </div>

              <div className="flex-1 grid grid-cols-1 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Nom de l'entreprise <span className="text-destructive">*</span></Label>
                  <Input id="name" value={form.name} onChange={set("name")} required placeholder="Ex: Nawras SARL" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="legalName">Raison sociale</Label>
                  <Input id="legalName" value={form.legalName} onChange={set("legalName")} placeholder="Dénomination légale complète" />
                </div>
              </div>
            </div>

            <Separator />

            {/* NIF & RC */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="taxNumber">NIF (Numéro d'Identification Fiscale)</Label>
                <Input id="taxNumber" value={form.taxNumber} onChange={set("taxNumber")} placeholder="Ex: MR12345678" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="registrationNumber">Registre de Commerce (RC)</Label>
                <Input id="registrationNumber" value={form.registrationNumber} onChange={set("registrationNumber")} placeholder="Ex: NKC-2024-B-1234" />
              </div>
            </div>

            {/* Email & Téléphone */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={form.email} onChange={set("email")} placeholder="contact@entreprise.mr" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Téléphone</Label>
                <Input id="phone" value={form.phone} onChange={set("phone")} placeholder="+222 XX XX XX XX" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Adresse */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Adresse
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="address">Adresse complète</Label>
              <Textarea
                id="address"
                value={form.address}
                onChange={set("address")}
                placeholder="Rue, Quartier, BP…"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="city">Ville</Label>
                <Input id="city" value={form.city} onChange={set("city")} placeholder="Ex: Nouakchott" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="country">Pays</Label>
                <Input id="country" value={form.country} onChange={set("country")} placeholder="Mauritanie" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Devise / Monnaie */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Coins className="h-4 w-4 text-primary" />
              Monnaie
            </CardTitle>
            <CardDescription>
              Devise utilisée pour les devis, factures, dépenses et tous les montants affichés dans l'application
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 max-w-md">
              <Label htmlFor="currency">Devise par défaut</Label>
              <Select
                value={form.currency}
                onValueChange={(value) => { setForm((p) => ({ ...p, currency: value })); setSuccess(false); }}
              >
                <SelectTrigger id="currency">
                  <SelectValue placeholder="Choisir une devise" />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      <span className="font-mono mr-2">{c.symbol}</span> {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Le changement s'appliquera immédiatement à l'affichage des montants et au montant en lettres sur les documents.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Coordonnées bancaires */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Banknote className="h-4 w-4 text-primary" />
              Coordonnées bancaires
            </CardTitle>
            <CardDescription>Ces informations apparaîtront sur les factures et proformas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="bankName">Nom de la banque</Label>
              <Input id="bankName" value={form.bankName} onChange={set("bankName")} placeholder="Ex: Banque Nationale de Mauritanie" />
            </div>

            {/* RIB decomposé */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Numéro de compte (RIB)</Label>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bankCode" className="text-xs text-muted-foreground">Code Banque</Label>
                  <Input
                    id="bankCode"
                    value={form.bankCode}
                    onChange={set("bankCode")}
                    placeholder="XXXXX"
                    maxLength={10}
                    className="text-center font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="branchCode" className="text-xs text-muted-foreground">Code Agence</Label>
                  <Input
                    id="branchCode"
                    value={form.branchCode}
                    onChange={set("branchCode")}
                    placeholder="XXXXX"
                    maxLength={10}
                    className="text-center font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="accountNumber" className="text-xs text-muted-foreground">Numéro de compte</Label>
                  <Input
                    id="accountNumber"
                    value={form.accountNumber}
                    onChange={set("accountNumber")}
                    placeholder="XXXXXXXXXXX"
                    maxLength={20}
                    className="text-center font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ribKey" className="text-xs text-muted-foreground">Clé RIB</Label>
                  <Input
                    id="ribKey"
                    value={form.ribKey}
                    onChange={set("ribKey")}
                    placeholder="XX"
                    maxLength={5}
                    className="text-center font-mono"
                  />
                </div>
              </div>
            </div>

            {/* RIB complet */}
            <div className="space-y-1.5">
              <Label htmlFor="rib">RIB complet</Label>
              <Input
                id="rib"
                value={form.rib}
                onChange={set("rib")}
                placeholder="Ex: 00001 00001 00000000001 00"
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">Format complet du relevé d'identité bancaire</p>
            </div>

            {/* SWIFT / BIC */}
            <div className="space-y-1.5">
              <Label htmlFor="swiftCode">Code SWIFT / BIC</Label>
              <Input
                id="swiftCode"
                value={form.swiftCode}
                onChange={(e) => setForm((p) => ({ ...p, swiftCode: e.target.value.toUpperCase() }))}
                placeholder="Ex: BNMAMRNU"
                maxLength={11}
                className="font-mono uppercase"
              />
              <p className="text-xs text-muted-foreground">Code d'identification international de la banque (8 ou 11 caractères)</p>
            </div>
          </CardContent>
        </Card>

        {/* Save button */}
        <div className="flex items-center justify-between pt-2">
          {success && (
            <p className="text-sm text-green-600 font-medium">✓ Paramètres enregistrés avec succès</p>
          )}
          {!success && <span />}
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </div>

      </form>
    </div>
  );
}
