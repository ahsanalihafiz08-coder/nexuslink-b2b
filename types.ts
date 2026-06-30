export type Incoterm = "FOB" | "CIF" | "EXW" | "DDP";

export type ShippingMethod = "Ocean FCL (Full Container)" | "Ocean LCL (Less Container)" | "Air Freight Express";

export interface B2BComponent {
  id: string;
  name: string;
  category: string;
  suggestedHsCode: string;
  basePriceUSD: number;
  moq: number; // Minimum Order Quantity
  leadTimeDays: number;
  manufacturerPort: string;
  weightKgPerUnit: number;
  description: string;
}

export interface PortData {
  id: string;
  name: string;
  code: string;
  country: string;
  region: string;
  type: "EXPORT" | "IMPORT" | "BOTH";
  standardPortHandlingFeeUSD: number;
  typicalTransitDaysFromShenzhen: number;
}

export interface SourcingContext {
  selectedComponentId: string;
  customComponentName: string;
  sourcePortId: string;
  destPortId: string;
  incoterm: Incoterm;
  shippingMethod: ShippingMethod;
  quantity: number;
  unitPriceUSD: number;
  freightCostUSD: number;
  insuranceCostUSD: number;
  customsAgentFeeUSD: number;
}

export interface RequiredDocument {
  name: string;
  purpose: string;
  urgency: "CRITICAL" | "HIGH" | "STANDARD";
  issuer: string;
}

export interface ComplianceAuditResult {
  hsCode: string;
  dutyRatePercentage: number;
  regulatoryDutyPercentage: number;
  salesTaxPercentage: number;
  additionalCustomsDutyPercentage: number;
  withholdingTaxPercentage: number;
  isFtaEligible: boolean;
  ftaSavingsPercentage: number;
  requiredDocuments: RequiredDocument[];
  regulatoryComplianceNotes: string[];
  clearanceSteps: string[];
  riskAssessment: "LOW RISK" | "MODERATE RISK" | "HIGH RISK";
  summaryNote: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface LandedCostBreakdown {
  fobValue: number;
  freight: number;
  insurance: number;
  cifValue: number;
  baseCustomsDuty: number;
  ftaDiscount: number;
  netCustomsDuty: number;
  regulatoryDuty: number;
  additionalCustomsDuty: number;
  salesTax: number;
  withholdingTax: number;
  portHandlingAndLocalCharges: number;
  landedCostUSD: number;
  effectiveDutyAndTaxPercentage: number;
  perUnitLandedCost: number;
}
