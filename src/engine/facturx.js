// Factur-X : XML réglementaire (norme EN 16931, syntaxe CII, profil BASIC) d'une facture émise.
// Le PDF visible + ce XML forment la facture « Factur-X » attendue par la réforme 2026/2027.
// Montants en euros à 2 décimales ; dates au format 102 (AAAAMMJJ).
import { ligneHT, totaux } from './devis.js';

const euros = (c) => (Math.round(Number(c) || 0) / 100).toFixed(2);
const d8 = (ymd) => String(ymd || '').replace(/-/g, '').slice(0, 8);
const esc = (s) =>
  String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
const une = (s) => esc(String(s || '').replace(/\s*\n\s*/g, ', ').trim());
// Quantité : jusqu'à 4 décimales, sans zéros inutiles
const qte = (n) => {
  const v = Number(n) || 0;
  return (Math.round(v * 10000) / 10000).toString();
};
const taux = (bp) => (Number(bp) / 100).toFixed(2); // 2000 -> "20.00"
const sirenDe = (siret) => String(siret || '').replace(/\D/g, '').slice(0, 9);

// Code unité UN/ECE Rec 20 (approché) ; défaut C62 = « unité »
const UNITES = { u: 'C62', h: 'HUR', jour: 'DAY', forfait: 'C62', 'm²': 'MTK', m: 'MTR', ml: 'MTR', 'm³': 'MTQ', kg: 'KGM', lot: 'C62' };
const uniteCode = (u) => UNITES[u] || 'C62';

const PROFIL = 'urn:cen.eu:en16931:2017#compliant#urn:factur-x.eu:1p0:basic';
const MOTIF_FRANCHISE = 'TVA non applicable, article 293 B du CGI';

function adresseXml(adresse) {
  const l = une(adresse);
  return `<ram:PostalTradeAddress>${l ? `<ram:LineOne>${l}</ram:LineOne>` : ''}<ram:CountryID>FR</ram:CountryID></ram:PostalTradeAddress>`;
}

function partie(p, { vendeur = false } = {}) {
  const siren = sirenDe(p.siret);
  const legal = siren ? `<ram:SpecifiedLegalOrganization><ram:ID schemeID="0002">${siren}</ram:ID></ram:SpecifiedLegalOrganization>` : '';
  const tvaId = vendeur && !p.franchise && p.tva ? `<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">${esc(String(p.tva).replace(/\s/g, ''))}</ram:ID></ram:SpecifiedTaxRegistration>` : '';
  return `<ram:Name>${une(p.nom)}</ram:Name>${legal}${adresseXml(p.adresse)}${tvaId}`;
}

// Catégorie de TVA : E = exonéré (franchise), S = taux normal, Z = taux zéro
const categorie = (franchise, bp) => (franchise ? 'E' : Number(bp) > 0 ? 'S' : 'Z');

export function xmlFacturX(f) {
  const v = f.vendeur || {};
  const franchise = v.franchise === true;
  const t = totaux(f.lignes, { franchise });
  const net = Math.max(0, t.ttc - (Number(f.acompteVerse) || 0));

  const lignes = (f.lignes || [])
    .map((l, i) => {
      const bp = franchise ? 0 : Number(l.tva) || 0;
      return (
        `<ram:IncludedSupplyChainTradeLineItem>` +
        `<ram:AssociatedDocumentLineDocument><ram:LineID>${i + 1}</ram:LineID></ram:AssociatedDocumentLineDocument>` +
        `<ram:SpecifiedTradeProduct><ram:Name>${une(l.designation) || 'Prestation'}</ram:Name></ram:SpecifiedTradeProduct>` +
        `<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>${euros(l.prixHT)}</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>` +
        `<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="${uniteCode(l.unite)}">${qte(l.quantite)}</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>` +
        `<ram:SpecifiedLineTradeSettlement>` +
        `<ram:ApplicableTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>${categorie(franchise, bp)}</ram:CategoryCode><ram:RateApplicablePercent>${taux(bp)}</ram:RateApplicablePercent></ram:ApplicableTradeTax>` +
        `<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>${euros(ligneHT(l))}</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation>` +
        `</ram:SpecifiedLineTradeSettlement>` +
        `</ram:IncludedSupplyChainTradeLineItem>`
      );
    })
    .join('');

  // Ventilation de TVA (en-tête)
  const groupes = franchise ? [{ base: t.ht, tva: 0, taux: 0 }] : t.tvas;
  const taxes = groupes
    .map((g) => {
      const cat = categorie(franchise, g.taux);
      const motif = cat === 'E' ? `<ram:ExemptionReason>${esc(MOTIF_FRANCHISE)}</ram:ExemptionReason>` : '';
      return (
        `<ram:ApplicableTradeTax>` +
        `<ram:CalculatedAmount>${euros(g.tva)}</ram:CalculatedAmount>` +
        `<ram:TypeCode>VAT</ram:TypeCode>` +
        motif +
        `<ram:BasisAmount>${euros(g.base)}</ram:BasisAmount>` +
        `<ram:CategoryCode>${cat}</ram:CategoryCode>` +
        `<ram:RateApplicablePercent>${taux(g.taux)}</ram:RateApplicablePercent>` +
        `</ram:ApplicableTradeTax>`
      );
    })
    .join('');

  const prepaid = Number(f.acompteVerse) > 0 ? `<ram:TotalPrepaidAmount>${euros(f.acompteVerse)}</ram:TotalPrepaidAmount>` : '';

  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100" xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100">` +
    `<rsm:ExchangedDocumentContext><ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>${PROFIL}</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>` +
    `<rsm:ExchangedDocument><ram:ID>${esc(f.numero)}</ram:ID><ram:TypeCode>380</ram:TypeCode><ram:IssueDateTime><udt:DateTimeString format="102">${d8(f.emiseLe)}</udt:DateTimeString></ram:IssueDateTime></rsm:ExchangedDocument>` +
    `<rsm:SupplyChainTradeTransaction>` +
    lignes +
    `<ram:ApplicableHeaderTradeAgreement>` +
    `<ram:SellerTradeParty>${partie(v, { vendeur: true })}</ram:SellerTradeParty>` +
    `<ram:BuyerTradeParty>${partie(f.client || {})}</ram:BuyerTradeParty>` +
    `</ram:ApplicableHeaderTradeAgreement>` +
    `<ram:ApplicableHeaderTradeDelivery><ram:ActualDeliverySupplyChainEvent><ram:OccurrenceDateTime><udt:DateTimeString format="102">${d8(f.datePrestation || f.emiseLe)}</udt:DateTimeString></ram:OccurrenceDateTime></ram:ActualDeliverySupplyChainEvent></ram:ApplicableHeaderTradeDelivery>` +
    `<ram:ApplicableHeaderTradeSettlement>` +
    `<ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>` +
    taxes +
    (f.echeance ? `<ram:SpecifiedTradePaymentTerms><ram:DueDateDateTime><udt:DateTimeString format="102">${d8(f.echeance)}</udt:DateTimeString></ram:DueDateDateTime></ram:SpecifiedTradePaymentTerms>` : '') +
    `<ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    `<ram:LineTotalAmount>${euros(t.ht)}</ram:LineTotalAmount>` +
    `<ram:TaxBasisTotalAmount>${euros(t.ht)}</ram:TaxBasisTotalAmount>` +
    `<ram:TaxTotalAmount currencyID="EUR">${euros(t.tva)}</ram:TaxTotalAmount>` +
    `<ram:GrandTotalAmount>${euros(t.ttc)}</ram:GrandTotalAmount>` +
    prepaid +
    `<ram:DuePayableAmount>${euros(net)}</ram:DuePayableAmount>` +
    `</ram:SpecifiedTradeSettlementHeaderMonetarySummation>` +
    `</ram:ApplicableHeaderTradeSettlement>` +
    `</rsm:SupplyChainTradeTransaction>` +
    `</rsm:CrossIndustryInvoice>`
  );
}
