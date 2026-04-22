import { useEffect, useRef } from "react";
import { useGetMyCompany } from "@workspace/api-client-react";
import type { DocumentItem } from "@workspace/api-client-react";
import { numberToWords } from "@/lib/number-to-words";
import { getCurrency } from "@/lib/currencies";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export type PrintDocType = "DEVIS" | "FACTURE PROFORMA" | "FACTURE";

interface PrintDocumentProps {
  docType: PrintDocType;
  docNumber: string;
  issueDate: string;
  validUntil?: string | null;
  dueDate?: string | null;
  partnerName?: string | null;
  subject?: string | null;
  notes?: string | null;
  items: DocumentItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
  onClose: () => void;
}

export function PrintDocument({
  docType, docNumber, issueDate, validUntil, dueDate,
  partnerName, subject, notes, items, subtotal, taxAmount, total, onClose,
}: PrintDocumentProps) {
  const { data: company } = useGetMyCompany();
  const printRef = useRef<HTMLDivElement>(null);
  const currency = getCurrency(company?.currency);
  const fmt = (val: number) =>
    new Intl.NumberFormat(currency.locale, { minimumFractionDigits: currency.decimals, maximumFractionDigits: currency.decimals }).format(val);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const handlePrint = () => {
    const content = printRef.current?.innerHTML ?? "";
    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>${docType} ${docNumber}</title>
<style>
  @page { size: A4; margin: 18mm 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 10pt; color: #111; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
  .logo { max-height: 70px; max-width: 150px; object-fit: contain; }
  .company-info { text-align: right; font-size: 9pt; line-height: 1.5; }
  .company-name { font-size: 13pt; font-weight: bold; margin-bottom: 4px; }
  .doc-title { text-align: center; margin: 18px 0 14px; }
  .doc-title h1 { font-size: 18pt; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; border-bottom: 3px solid #1a56db; display: inline-block; padding-bottom: 4px; color: #1a56db; }
  .doc-meta { display: flex; justify-content: space-between; margin-bottom: 16px; gap: 20px; }
  .meta-box { background: #f7f8fa; border: 1px solid #dde; padding: 10px 14px; border-radius: 5px; flex: 1; }
  .meta-box .label { font-size: 8pt; color: #666; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2px; }
  .meta-box .value { font-size: 10pt; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; margin: 14px 0; }
  th { background: #1a56db; color: white; padding: 7px 8px; font-size: 9pt; text-align: left; }
  th.right, td.right { text-align: right; }
  td { padding: 6px 8px; font-size: 9pt; border-bottom: 1px solid #eee; }
  tr:nth-child(even) td { background: #f7f8fa; }
  .totals { display: flex; justify-content: flex-end; margin-top: 6px; }
  .totals-box { width: 260px; }
  .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 9.5pt; border-bottom: 1px solid #eee; }
  .totals-row.total-ttc { font-size: 12pt; font-weight: bold; border-top: 2px solid #1a56db; border-bottom: none; padding-top: 8px; color: #1a56db; }
  .arrete { margin-top: 20px; background: #f0f4ff; border: 1px solid #c5d3f5; border-radius: 5px; padding: 12px 16px; font-size: 9.5pt; line-height: 1.6; }
  .arrete strong { text-transform: uppercase; }
  .footer-bank { margin-top: 16px; font-size: 8.5pt; color: #444; border-top: 1px solid #dde; padding-top: 10px; }
  .notes { margin-top: 14px; font-size: 9pt; color: #555; border-top: 1px dashed #ccc; padding-top: 10px; }
  .signature-area { display: flex; justify-content: space-between; margin-top: 30px; }
  .sig-box { width: 42%; border-top: 1px solid #aaa; padding-top: 8px; font-size: 9pt; text-align: center; color: #555; }
</style>
</head>
<body>
${content}
</body>
</html>`);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  };

  const rib = company?.rib || [company?.bankCode, company?.branchCode, company?.accountNumber, company?.ribKey].filter(Boolean).join(" ");

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto p-4 print:p-0">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex gap-2 mb-4 print:hidden">
        <button
          onClick={handlePrint}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2 rounded shadow text-sm"
        >
          🖨 Imprimer / Enregistrer PDF
        </button>
        <button
          onClick={onClose}
          className="bg-white hover:bg-gray-100 text-gray-800 font-medium px-5 py-2 rounded shadow text-sm border"
        >
          ✕ Fermer
        </button>
      </div>

      {/* Document */}
      <div className="bg-white shadow-2xl rounded w-full max-w-3xl print:shadow-none print:rounded-none">
        <div ref={printRef} style={{ padding: "18mm 15mm", fontFamily: "Arial, Helvetica, sans-serif", fontSize: "10pt", color: "#111" }}>

          {/* En-tête entreprise */}
          <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              {company?.logo && (
                <img src={company.logo} alt="Logo" className="logo" style={{ maxHeight: 70, maxWidth: 150, objectFit: "contain" }} />
              )}
              {!company?.logo && (
                <div style={{ fontSize: 16, fontWeight: "bold", color: "#1a56db" }}>{company?.name || ""}</div>
              )}
            </div>
            <div className="company-info" style={{ textAlign: "right", fontSize: "9pt", lineHeight: 1.6 }}>
              <div className="company-name" style={{ fontSize: 14, fontWeight: "bold", marginBottom: 2 }}>{company?.name}</div>
              {company?.legalName && <div>{company.legalName}</div>}
              {company?.taxNumber && <div>NIF : {company.taxNumber}</div>}
              {company?.registrationNumber && <div>RC : {company.registrationNumber}</div>}
              {company?.address && <div>{company.address}</div>}
              {(company?.city || company?.country) && <div>{[company.city, company.country].filter(Boolean).join(", ")}</div>}
              {company?.phone && <div>Tél : {company.phone}</div>}
              {company?.email && <div>{company.email}</div>}
            </div>
          </div>

          {/* Titre document */}
          <div style={{ textAlign: "center", margin: "18px 0 14px" }}>
            <h1 style={{ fontSize: 18, fontWeight: "bold", letterSpacing: 2, textTransform: "uppercase", borderBottom: "3px solid #1a56db", display: "inline-block", paddingBottom: 4, color: "#1a56db" }}>
              {docType}
            </h1>
          </div>

          {/* Méta-données */}
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 16 }}>
            <div style={{ background: "#f7f8fa", border: "1px solid #dde", padding: "10px 14px", borderRadius: 5, flex: 1 }}>
              <div style={{ fontSize: "8pt", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Numéro</div>
              <div style={{ fontWeight: 700, fontSize: 11 }}>{docNumber}</div>
            </div>
            <div style={{ background: "#f7f8fa", border: "1px solid #dde", padding: "10px 14px", borderRadius: 5, flex: 1 }}>
              <div style={{ fontSize: "8pt", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Date d'émission</div>
              <div style={{ fontWeight: 600 }}>{format(new Date(issueDate), "dd MMMM yyyy", { locale: fr })}</div>
            </div>
            {validUntil && (
              <div style={{ background: "#f7f8fa", border: "1px solid #dde", padding: "10px 14px", borderRadius: 5, flex: 1 }}>
                <div style={{ fontSize: "8pt", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Valide jusqu'au</div>
                <div style={{ fontWeight: 600 }}>{format(new Date(validUntil), "dd MMMM yyyy", { locale: fr })}</div>
              </div>
            )}
            {dueDate && (
              <div style={{ background: "#f7f8fa", border: "1px solid #dde", padding: "10px 14px", borderRadius: 5, flex: 1 }}>
                <div style={{ fontSize: "8pt", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Échéance</div>
                <div style={{ fontWeight: 600 }}>{format(new Date(dueDate), "dd MMMM yyyy", { locale: fr })}</div>
              </div>
            )}
            <div style={{ background: "#e8f0fe", border: "1px solid #c5d3f5", padding: "10px 14px", borderRadius: 5, flex: 1.5 }}>
              <div style={{ fontSize: "8pt", color: "#666", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 2 }}>Client / Fournisseur</div>
              <div style={{ fontWeight: 700, fontSize: 11 }}>{partnerName || "—"}</div>
              {subject && <div style={{ fontSize: "9pt", color: "#444", marginTop: 2 }}>{subject}</div>}
            </div>
          </div>

          {/* Tableau des lignes */}
          <table style={{ width: "100%", borderCollapse: "collapse", margin: "14px 0" }}>
            <thead>
              <tr>
                <th style={{ background: "#1a56db", color: "white", padding: "7px 8px", fontSize: "9pt", textAlign: "left" }}>Description</th>
                <th style={{ background: "#1a56db", color: "white", padding: "7px 8px", fontSize: "9pt", textAlign: "right", width: 50 }}>Qté</th>
                <th style={{ background: "#1a56db", color: "white", padding: "7px 8px", fontSize: "9pt", textAlign: "right", width: 110 }}>P.U. ({currency.symbol})</th>
                <th style={{ background: "#1a56db", color: "white", padding: "7px 8px", fontSize: "9pt", textAlign: "right", width: 60 }}>TVA %</th>
                <th style={{ background: "#1a56db", color: "white", padding: "7px 8px", fontSize: "9pt", textAlign: "right", width: 110 }}>Total ({currency.symbol})</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => (
                <tr key={i}>
                  <td style={{ padding: "6px 8px", fontSize: "9pt", borderBottom: "1px solid #eee", background: i % 2 === 0 ? "white" : "#f7f8fa" }}>{item.description}</td>
                  <td style={{ padding: "6px 8px", fontSize: "9pt", borderBottom: "1px solid #eee", textAlign: "right", background: i % 2 === 0 ? "white" : "#f7f8fa" }}>{item.quantity}</td>
                  <td style={{ padding: "6px 8px", fontSize: "9pt", borderBottom: "1px solid #eee", textAlign: "right", background: i % 2 === 0 ? "white" : "#f7f8fa" }}>{fmt(item.unitPrice)}</td>
                  <td style={{ padding: "6px 8px", fontSize: "9pt", borderBottom: "1px solid #eee", textAlign: "right", background: i % 2 === 0 ? "white" : "#f7f8fa" }}>{item.taxRate}%</td>
                  <td style={{ padding: "6px 8px", fontSize: "9pt", borderBottom: "1px solid #eee", textAlign: "right", fontWeight: 600, background: i % 2 === 0 ? "white" : "#f7f8fa" }}>{fmt(item.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totaux */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <div style={{ width: 260 }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "9.5pt", borderBottom: "1px solid #eee" }}>
                <span>Sous-total HT</span><span>{fmt(subtotal)} {currency.symbol}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: "9.5pt", borderBottom: "1px solid #eee" }}>
                <span>TVA</span><span>{fmt(taxAmount)} {currency.symbol}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0 4px", fontSize: "13pt", fontWeight: "bold", borderTop: "2px solid #1a56db", color: "#1a56db" }}>
                <span>TOTAL TTC</span><span>{fmt(total)} {currency.symbol}</span>
              </div>
            </div>
          </div>

          {/* Arrêté */}
          <div style={{ marginTop: 20, background: "#f0f4ff", border: "1px solid #c5d3f5", borderRadius: 5, padding: "12px 16px", fontSize: "9.5pt", lineHeight: 1.7 }}>
            <span style={{ fontWeight: "bold" }}>Arrêté le présent {docType.toLowerCase()} à la somme de :</span><br />
            <span style={{ fontWeight: "bold", textTransform: "uppercase", color: "#1a56db", fontSize: "10pt" }}>
              {numberToWords(total, currency.code)}
            </span>
          </div>

          {/* Coordonnées bancaires */}
          {(company?.bankName || rib || company?.swiftCode) && (
            <div style={{ marginTop: 16, fontSize: "8.5pt", color: "#444", borderTop: "1px solid #dde", paddingTop: 10 }}>
              <strong>Coordonnées bancaires</strong>
              <div style={{ marginTop: 4, lineHeight: 1.7 }}>
                {company?.bankName && <span>Banque : {company.bankName} &nbsp;|&nbsp; </span>}
                {rib && <span>RIB : {rib} &nbsp;|&nbsp; </span>}
                {company?.swiftCode && <span>SWIFT : {company.swiftCode}</span>}
              </div>
            </div>
          )}

          {/* Notes */}
          {notes && (
            <div style={{ marginTop: 14, fontSize: "9pt", color: "#555", borderTop: "1px dashed #ccc", paddingTop: 10 }}>
              <strong>Notes :</strong> {notes}
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 36 }}>
            <div style={{ width: "42%", borderTop: "1px solid #aaa", paddingTop: 8, fontSize: "9pt", textAlign: "center", color: "#555" }}>
              Signature du client
            </div>
            <div style={{ width: "42%", borderTop: "1px solid #aaa", paddingTop: 8, fontSize: "9pt", textAlign: "center", color: "#555" }}>
              Cachet & Signature de {company?.name || "l'entreprise"}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
