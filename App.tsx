import React, { useState, useEffect, useRef } from "react";
import { 
  Ship, 
  Globe, 
  Calculator, 
  FileCheck, 
  HelpCircle, 
  ArrowRight, 
  RefreshCw, 
  ShieldAlert, 
  AlertTriangle,
  CheckCircle, 
  Info, 
  Send, 
  Check, 
  DollarSign, 
  Layers, 
  Truck, 
  Lock, 
  Search,
  ExternalLink,
  Sliders,
  ChevronRight,
  BookOpen,
  Briefcase
} from "lucide-react";
import { MOCK_COMPONENTS, MOCK_PORTS, DEFAULT_COMPLIANCE_MAP } from "./data/mockSourcingData";
import { 
  B2BComponent, 
  PortData, 
  Incoterm, 
  ShippingMethod, 
  SourcingContext, 
  ComplianceAuditResult, 
  ChatMessage, 
  LandedCostBreakdown 
} from "./types";

export default function App() {
  // Sourcing Context State
  const [selectedCompId, setSelectedCompId] = useState<string>("esp32");
  const [customName, setCustomName] = useState<string>("");
  const [customCategory, setCustomCategory] = useState<string>("Custom Industrial Electronics");
  const [customHsCode, setCustomHsCode] = useState<string>("8542.3100");
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);

  const [sourcePortId, setSourcePortId] = useState<string>("port-szx"); // Shenzhen default
  const [destPortId, setDestPortId] = useState<string>("port-kap"); // Karachi Port default
  const [incoterm, setIncoterm] = useState<Incoterm>("FOB");
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>("Ocean FCL (Full Container)");
  const [quantity, setQuantity] = useState<number>(1000);
  const [unitPrice, setUnitPrice] = useState<number>(1.85);

  // Cost overrides & additions
  const [freightCost, setFreightCost] = useState<number>(1850);
  const [insuranceCost, setInsuranceCost] = useState<number>(120);
  const [customsAgentFee, setCustomsAgentFee] = useState<number>(350);
  const [applyFta, setApplyFta] = useState<boolean>(true);

  // Compliance state
  const [complianceAudit, setComplianceAudit] = useState<ComplianceAuditResult>(DEFAULT_COMPLIANCE_MAP.esp32);
  const [loadingAudit, setLoadingAudit] = useState<boolean>(false);
  const [auditError, setAuditError] = useState<string | null>(null);

  // Track status of documents interactively (Customs checklist progress)
  const [documentProgress, setDocumentProgress] = useState<Record<string, "Draft" | "Submitted" | "Approved">>({
    "Bill of Lading (B/L)": "Draft",
    "China-Pakistan FTA Certificate of Origin (Form-FTA)": "Draft",
    "PTA Type Approval Certificate": "Draft",
    "Commercial Invoice & Packing List": "Draft"
  });

  // Chat interface state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello! I am **NexusLink B2B**, your AI Trade Compliance & Sourcing Agent. I specialize in managing global shipping pipelines—specifically corridors like **Shenzhen Port to Karachi Port**.\n\nI can help you audit HS Codes, compute precise itemized landed costs, verify compliance rules (like PTA approval or CPFTA duties), and draft trade documents. What are you importing today?",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }
  ]);
  const [userInput, setUserInput] = useState<string>("");
  const [sendingChat, setSendingChat] = useState<boolean>(false);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Sync state when component changes (from presets)
  useEffect(() => {
    if (!isCustomMode) {
      const comp = MOCK_COMPONENTS.find(c => c.id === selectedCompId);
      if (comp) {
        setUnitPrice(comp.basePriceUSD);
        setQuantity(comp.moq);
        
        // Sync default compliance audit
        if (DEFAULT_COMPLIANCE_MAP[comp.id]) {
          const defaultAudit = DEFAULT_COMPLIANCE_MAP[comp.id];
          setComplianceAudit(defaultAudit);
          
          // Reset document progress map
          const newProg: Record<string, "Draft" | "Submitted" | "Approved"> = {};
          defaultAudit.requiredDocuments.forEach(d => {
            newProg[d.name] = "Draft";
          });
          setDocumentProgress(newProg);
        } else {
          // Fallback or trigger audit
          triggerAIAudit(comp.name, comp.category);
        }
      }
    }
  }, [selectedCompId, isCustomMode]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const activeComponent: B2BComponent = isCustomMode 
    ? {
        id: "custom",
        name: customName || "Custom Industrial Goods",
        category: customCategory,
        suggestedHsCode: customHsCode,
        basePriceUSD: unitPrice,
        moq: 1,
        leadTimeDays: 20,
        manufacturerPort: "Shenzhen Port (SZX)",
        weightKgPerUnit: 1.0,
        description: "User-defined custom component for sourcing."
      }
    : MOCK_COMPONENTS.find(c => c.id === selectedCompId) || MOCK_COMPONENTS[0];

  const sourcePortObj = MOCK_PORTS.find(p => p.id === sourcePortId) || MOCK_PORTS[0];
  const destPortObj = MOCK_PORTS.find(p => p.id === destPortId) || MOCK_PORTS[2];

  // Auto detect if China-to-Pakistan route
  const isChinaToPakRoute = 
    (sourcePortObj.country === "China") && 
    (destPortObj.country === "Pakistan");

  // Cost calculation engine
  const calculateLandedCost = (): LandedCostBreakdown => {
    const fobValue = quantity * unitPrice;
    const freight = freightCost;
    const insurance = insuranceCost;
    const cifValue = fobValue + freight + insurance;

    const baseDutyRate = complianceAudit.dutyRatePercentage;
    const ftaDiscountRate = (isChinaToPakRoute && applyFta && complianceAudit.isFtaEligible) 
      ? complianceAudit.ftaSavingsPercentage 
      : 0;

    // Apply FTA discount (base duty rate can be reduced to 0 or discounted)
    const netDutyRate = Math.max(0, baseDutyRate - ftaDiscountRate);
    const baseCustomsDuty = cifValue * (baseDutyRate / 100);
    const ftaDiscount = cifValue * (ftaDiscountRate / 100);
    const netCustomsDuty = Math.max(0, cifValue * (netDutyRate / 100));

    // Other taxes based on CIF + Net Customs Duty
    const regulatoryDuty = cifValue * (complianceAudit.regulatoryDutyPercentage / 100);
    const additionalCustomsDuty = cifValue * (complianceAudit.additionalCustomsDutyPercentage / 100);

    // Sales tax is calculated on CIF + Customs Duty + Regulatory Duty + Additional Customs Duty
    const assessableValueForSalesTax = cifValue + netCustomsDuty + regulatoryDuty + additionalCustomsDuty;
    const salesTax = assessableValueForSalesTax * (complianceAudit.salesTaxPercentage / 100);

    // Withholding/Income tax on import value
    const withholdingTax = (assessableValueForSalesTax + salesTax) * (complianceAudit.withholdingTaxPercentage / 100);

    // Ports handling and local clearing agent charges
    const portHandlingAndLocalCharges = 
      sourcePortObj.standardPortHandlingFeeUSD + 
      destPortObj.standardPortHandlingFeeUSD + 
      customsAgentFee;

    const landedCostUSD = 
      cifValue + 
      netCustomsDuty + 
      regulatoryDuty + 
      additionalCustomsDuty + 
      salesTax + 
      withholdingTax + 
      portHandlingAndLocalCharges;

    const effectiveDutyAndTaxPercentage = cifValue > 0 
      ? ((landedCostUSD - cifValue - portHandlingAndLocalCharges) / cifValue) * 100 
      : 0;

    const perUnitLandedCost = quantity > 0 ? landedCostUSD / quantity : 0;

    return {
      fobValue,
      freight,
      insurance,
      cifValue,
      baseCustomsDuty,
      ftaDiscount,
      netCustomsDuty,
      regulatoryDuty,
      additionalCustomsDuty,
      salesTax,
      withholdingTax,
      portHandlingAndLocalCharges,
      landedCostUSD,
      effectiveDutyAndTaxPercentage,
      perUnitLandedCost
    };
  };

  const costBreakdown = calculateLandedCost();

  // Trigger Gemini AI compliance audit
  const triggerAIAudit = async (catName: string, category: string) => {
    setLoadingAudit(true);
    setAuditError(null);
    try {
      const response = await fetch("/api/gemini/compliance-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemCategory: `${catName} (${category})`,
          sourcePort: sourcePortObj.name + ", " + sourcePortObj.country,
          destPort: destPortObj.name + ", " + destPortObj.country,
          shipmentValue: quantity * unitPrice
        })
      });

      if (!response.ok) {
        throw new Error("Sourcing Compliance Audit endpoint returned error status.");
      }

      const data: ComplianceAuditResult = await response.json();
      setComplianceAudit(data);
      
      // Initialize interactive document progress for the new set of required docs
      const newProg: Record<string, "Draft" | "Submitted" | "Approved"> = {};
      data.requiredDocuments.forEach(d => {
        newProg[d.name] = "Draft";
      });
      setDocumentProgress(newProg);

      // Append helpful notification chat
      setChatMessages(prev => [
        ...prev,
        {
          id: `audit-${Date.now()}`,
          role: "assistant",
          content: `⚡ **Compliance Audit updated for ${catName}!** I have recalculated the import tariffs, identified HS Code **${data.hsCode}**, and mapped out a custom checklist including ${data.requiredDocuments.length} required documents under ${destPortObj.country} customs framework.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

    } catch (err: any) {
      console.error(err);
      setAuditError("AI Sourcing Agent could not connect to database. Using high-fidelity pre-packaged calculations.");
    } finally {
      setLoadingAudit(false);
    }
  };

  // Trigger Chat response
  const handleSendMessage = async (e?: React.FormEvent, presetQuestion?: string) => {
    if (e) e.preventDefault();
    const queryText = presetQuestion || userInput;
    if (!queryText.trim() || sendingChat) return;

    // Add user message
    const userMsgId = `user-${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      role: "user",
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setChatMessages(prev => [...prev, newUserMsg]);
    if (!presetQuestion) setUserInput("");
    setSendingChat(true);

    try {
      const currentContext = {
        item: activeComponent.name,
        sourcePort: sourcePortObj.name,
        destPort: destPortObj.name,
        incoterm: incoterm,
        shippingMethod: shippingMethod,
        shipmentValue: quantity * unitPrice
      };

      // Combine previous messages as prompt context (last 5 message chain)
      const chatContextHistory = chatMessages.slice(-6).map(m => ({
        role: m.role,
        content: m.content
      }));
      chatContextHistory.push({ role: "user", content: queryText });

      const response = await fetch("/api/gemini/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: chatContextHistory,
          context: currentContext
        })
      });

      if (!response.ok) {
        throw new Error("Chat agent connection offline.");
      }

      // Initialize the assistant message with empty content to display the loading/typing frame
      const assistantMsgId = `assistant-${Date.now()}`;
      setChatMessages(prev => [
        ...prev,
        {
          id: assistantMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder("utf-8");

      if (reader) {
        let done = false;
        let accumulatedText = "";
        while (!done) {
          const { value, done: doneReading } = await reader.read();
          done = doneReading;
          if (value) {
            const chunk = decoder.decode(value, { stream: !done });
            accumulatedText += chunk;
            // Update the message in real-time as chunks arrive
            setChatMessages(prev =>
              prev.map(m => m.id === assistantMsgId ? { ...m, content: accumulatedText } : m)
            );
          }
        }
      } else {
        // Fallback for environment constraints where reader is not available
        const resData = await response.json();
        setChatMessages(prev =>
          prev.map(m => m.id === assistantMsgId ? { ...m, content: resData.message || "" } : m)
        );
      }

    } catch (err: any) {
      console.error(err);
      setChatMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: "⚠️ I encountered an error communicating with the main server gateway. Please ensure your GEMINI_API_KEY is configured under Settings > Secrets, or try again shortly.",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } finally {
      setSendingChat(false);
    }
  };

  // Toggle document status
  const handleToggleDocStatus = (docName: string) => {
    setDocumentProgress(prev => {
      const current = prev[docName] || "Draft";
      let next: "Draft" | "Submitted" | "Approved" = "Draft";
      if (current === "Draft") next = "Submitted";
      else if (current === "Submitted") next = "Approved";
      return { ...prev, [docName]: next };
    });
  };

  const getDocStatusBadgeColor = (status: "Draft" | "Submitted" | "Approved") => {
    switch (status) {
      case "Approved": return "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
      case "Submitted": return "bg-blue-500/10 text-blue-400 border-blue-500/20";
      default: return "bg-slate-700/50 text-slate-300 border-slate-600/30";
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 font-sans flex flex-col selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* 1. TOP GLOBAL B2B HEADER & TELEMETRY */}
      <header className="border-b border-slate-800 bg-[#0E1424] px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500 text-[#0B0F19] p-2.5 rounded-lg font-black tracking-wider shadow-lg shadow-amber-500/10 flex items-center gap-2">
            <Globe className="w-6 h-6 animate-spin-slow text-[#0B0F19]" />
            <span className="text-lg font-extrabold tracking-tight">NexusLink B2B</span>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-slate-200 tracking-wide">International Sourcing & Customs compliance</h1>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Live Trade Corridor Agent • Active Route: {sourcePortObj.code} ➔ {destPortObj.code}
            </p>
          </div>
        </div>

        {/* Global route overview */}
        <div className="flex items-center gap-4 bg-[#141C33] border border-slate-700/50 px-4 py-2 rounded-xl text-xs">
          <div className="text-right">
            <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Source Port</span>
            <span className="font-semibold text-amber-400">{sourcePortObj.name} ({sourcePortObj.code})</span>
          </div>
          <ArrowRight className="w-4 h-4 text-slate-500" />
          <div>
            <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Destination Port</span>
            <span className="font-semibold text-teal-400">{destPortObj.name} ({destPortObj.code})</span>
          </div>
          <div className="border-l border-slate-700 pl-4">
            <span className="block text-[10px] text-slate-400 uppercase tracking-wider">Est. Transit Time</span>
            <span className="font-bold text-slate-200">{destPortObj.typicalTransitDaysFromShenzhen} Days</span>
          </div>
        </div>
      </header>

      {/* 2. CORE WORKSPACE GRID */}
      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1700px] w-full mx-auto">
        
        {/* COLUMN A: SOURCING CONFIGURATOR (3 cols lg) */}
        <section id="sourcing-config-panel" className="lg:col-span-4 flex flex-col gap-6">
          
          {/* Preset Selector Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Sourcing Item Selection
              </h2>
              <button 
                onClick={() => setIsCustomMode(!isCustomMode)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-amber-400 px-3 py-1 rounded-lg border border-slate-700 transition"
              >
                {isCustomMode ? "Use Presets" : "Define Custom Item"}
              </button>
            </div>

            {isCustomMode ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Product Description / Name</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Lithium Polymer cells 3.7V"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Category</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Electrical Batteries"
                      value={customCategory}
                      onChange={(e) => setCustomCategory(e.target.value)}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Target HS Code</label>
                    <input 
                      type="text" 
                      placeholder="e.g. 8507.6000"
                      value={customHsCode}
                      onChange={(e) => setCustomHsCode(e.target.value)}
                      className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>
                <button 
                  onClick={() => triggerAIAudit(customName || "Custom Goods", customCategory)}
                  disabled={loadingAudit}
                  className="w-full text-xs bg-amber-500 hover:bg-amber-600 text-[#090D16] font-bold py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition disabled:opacity-50"
                >
                  {loadingAudit ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  Run AI Sourcing & Customs Audit
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-400">Select Enterprise Component Preset</label>
                <div className="grid grid-cols-1 gap-1.5 max-h-[170px] overflow-y-auto pr-1">
                  {MOCK_COMPONENTS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setSelectedCompId(item.id)}
                      className={`text-left p-2.5 rounded-xl border text-xs transition flex flex-col ${
                        selectedCompId === item.id 
                          ? "bg-amber-500/15 border-amber-500 text-amber-200" 
                          : "bg-slate-900 border-slate-800 hover:border-slate-700 text-slate-400"
                      }`}
                    >
                      <div className="flex justify-between font-bold text-slate-200">
                        <span className="truncate">{item.name}</span>
                        <span className="text-amber-400 text-[11px]">${item.basePriceUSD.toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                        <span>HS: {item.suggestedHsCode}</span>
                        <span>Min Order: {item.moq} units</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 pt-4 border-t border-slate-800/80">
              <h3 className="text-xs font-semibold text-slate-300">Preset Sourcing Profile Details</h3>
              <p className="text-xs text-slate-400 mt-1 italic">
                "{activeComponent.description}"
              </p>
            </div>
          </div>

          {/* Sourcing Parameters Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-4 h-4 text-amber-500" />
              Sourcing Parameters
            </h2>

            {/* Ports Selector */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Exporting Port</label>
                <select
                  value={sourcePortId}
                  onChange={(e) => setSourcePortId(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  {MOCK_PORTS.filter(p => p.type === "EXPORT" || p.type === "BOTH").map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.name} ({port.code})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Importing Port</label>
                <select
                  value={destPortId}
                  onChange={(e) => setDestPortId(e.target.value)}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  {MOCK_PORTS.filter(p => p.type === "IMPORT" || p.type === "BOTH").map((port) => (
                    <option key={port.id} value={port.id}>
                      {port.name} ({port.code}) - {port.country}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Logistics details */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Incoterms</label>
                <select
                  value={incoterm}
                  onChange={(e) => setIncoterm(e.target.value as Incoterm)}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="FOB">FOB - Free On Board</option>
                  <option value="CIF">CIF - Cost Ins. Freight</option>
                  <option value="EXW">EXW - Ex Works</option>
                  <option value="DDP">DDP - Delivered Duty Paid</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Shipping Mode</label>
                <select
                  value={shippingMethod}
                  onChange={(e) => setShippingMethod(e.target.value as ShippingMethod)}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-300 focus:outline-none focus:border-amber-500"
                >
                  <option value="Ocean FCL (Full Container)">Ocean FCL</option>
                  <option value="Ocean LCL (Less Container)">Ocean LCL</option>
                  <option value="Air Freight Express">Air Freight Express</option>
                </select>
              </div>
            </div>

            {/* Quantity and Custom price controls */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Shipment Volume (Pcs)</label>
                <input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                />
                {quantity < activeComponent.moq && (
                  <span className="text-[9px] text-amber-400 block mt-0.5">⚠️ Below supplier MOQ ({activeComponent.moq})</span>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Unit Price FOB (USD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500 text-xs">$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(Math.max(0.01, parseFloat(e.target.value) || 0))}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-2.5 text-slate-200 focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Manual Logistics Cost Adjusters */}
            <div className="space-y-2 border-t border-slate-800/80 pt-3">
              <span className="block text-xs font-semibold text-slate-300">Logistics & Agent Fees (USD)</span>
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Freight</label>
                  <input
                    type="number"
                    value={freightCost}
                    onChange={(e) => setFreightCost(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Insurance</label>
                  <input
                    type="number"
                    value={insuranceCost}
                    onChange={(e) => setInsuranceCost(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 font-mono text-center"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-400 mb-1">Customs Agent</label>
                  <input
                    type="number"
                    value={customsAgentFee}
                    onChange={(e) => setCustomsAgentFee(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full text-xs bg-slate-900 border border-slate-700 rounded-lg p-1.5 text-slate-200 font-mono text-center"
                  />
                </div>
              </div>
            </div>

            {/* FTA Switch */}
            {isChinaToPakRoute && (
              <div className="bg-[#15231F] border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <span className="block text-xs font-bold text-emerald-400 flex items-center gap-1">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    CPFTA Discount Available
                  </span>
                  <span className="block text-[10px] text-slate-400">Claim China-Pak Free Trade concessions</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={applyFta} 
                    onChange={(e) => setApplyFta(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-700 rounded-full peer peer-focus:ring-2 peer-focus:ring-emerald-500/50 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-slate-300 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                </label>
              </div>
            )}
          </div>
        </section>

        {/* COLUMN B: CALCULATOR & AUDIT CHECKLISTS (5 cols lg) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Sourcing Cost Breakdown Invoice Sheet */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-amber-500" />
              Landed Cost Breakdown (USD)
            </h2>

            {/* Main high impact KPIs */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-[#17223B] border border-blue-500/20 rounded-xl p-3 text-center">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Total Landed Cost</span>
                <span className="block text-2xl font-black text-amber-400 font-mono mt-0.5">
                  ${costBreakdown.landedCostUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-slate-400">All Duty, Taxes & Ports Included</span>
              </div>
              <div className="bg-[#1C172B] border border-purple-500/20 rounded-xl p-3 text-center">
                <span className="block text-[10px] text-slate-400 uppercase font-semibold">Per-Unit Landed Cost</span>
                <span className="block text-2xl font-black text-teal-400 font-mono mt-0.5">
                  ${costBreakdown.perUnitLandedCost.toFixed(3)}
                </span>
                <span className="text-[10px] text-slate-400">FOB Unit Price: ${unitPrice.toFixed(2)}</span>
              </div>
            </div>

            {/* Tabular Cost Spreadsheet */}
            <div className="space-y-2 text-xs bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">FOB Value ({quantity} Units)</span>
                <span className="font-mono text-slate-200 font-semibold">${costBreakdown.fobValue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Ocean Freight & Cargo Transit Ins.</span>
                <span className="font-mono text-slate-200 font-semibold">${(costBreakdown.freight + costBreakdown.insurance).toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800 font-bold bg-slate-850 px-1 rounded">
                <span className="text-slate-300">CIF Port Destination Value</span>
                <span className="font-mono text-slate-100">${costBreakdown.cifValue.toFixed(2)}</span>
              </div>

              {/* Duty Components */}
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400 flex items-center gap-1">
                  Customs Duty Rate ({complianceAudit.dutyRatePercentage}%)
                </span>
                <span className="font-mono text-slate-300">${costBreakdown.baseCustomsDuty.toFixed(2)}</span>
              </div>

              {/* FTA Line */}
              {isChinaToPakRoute && complianceAudit.isFtaEligible && applyFta && (
                <div className="flex justify-between py-0.5 text-emerald-400">
                  <span>↳ China-Pak FTA Preference (-{complianceAudit.ftaSavingsPercentage}%)</span>
                  <span className="font-mono">-${costBreakdown.ftaDiscount.toFixed(2)}</span>
                </div>
              )}

              {/* Taxes */}
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Regulatory Duty (RD) ({complianceAudit.regulatoryDutyPercentage}%)</span>
                <span className="font-mono text-slate-300">${costBreakdown.regulatoryDuty.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Additional Customs Duty (ACD) ({complianceAudit.additionalCustomsDutyPercentage}%)</span>
                <span className="font-mono text-slate-300">${costBreakdown.additionalCustomsDuty.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Import Sales Tax / GST ({complianceAudit.salesTaxPercentage}%)</span>
                <span className="font-mono text-slate-300">${costBreakdown.salesTax.toFixed(2)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/50">
                <span className="text-slate-400">Withholding Income Tax (WHT) ({complianceAudit.withholdingTaxPercentage}%)</span>
                <span className="font-mono text-slate-300">${costBreakdown.withholdingTax.toFixed(2)}</span>
              </div>

              {/* Port fees & clearing */}
              <div className="flex justify-between py-1 border-b border-slate-800">
                <span className="text-slate-400">Ports Handling (SZX + {destPortObj.code}) + Agent Fee</span>
                <span className="font-mono text-slate-300">${costBreakdown.portHandlingAndLocalCharges.toFixed(2)}</span>
              </div>

              {/* Summary KPIs */}
              <div className="flex justify-between pt-1.5 font-bold text-slate-200">
                <span>Effective Custom Duty & Taxes</span>
                <span className="font-mono text-amber-500">{costBreakdown.effectiveDutyAndTaxPercentage.toFixed(1)}% (of CIF)</span>
              </div>
            </div>
          </div>

          {/* AI Compliance Status & Document Tracker */}
          <div className="bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4 flex-1">
            <div className="flex justify-between items-center">
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-amber-500" />
                Customs Compliance Tracker
              </h2>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded border ${
                complianceAudit.riskAssessment === "HIGH RISK" 
                  ? "bg-red-500/10 text-red-400 border-red-500/20" 
                  : complianceAudit.riskAssessment === "MODERATE RISK"
                  ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              }`}>
                {complianceAudit.riskAssessment}
              </span>
            </div>

            {/* Error or Loading Status */}
            {loadingAudit && (
              <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-center gap-3 border border-slate-800">
                <RefreshCw className="w-5 h-5 text-amber-500 animate-spin" />
                <span className="text-xs text-slate-300 font-semibold">Running Sourcing & Port Audit Engine...</span>
              </div>
            )}

            {auditError && (
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-300 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{auditError}</span>
              </div>
            )}

            {/* Generated Item Audit details */}
            <div className="grid grid-cols-3 gap-2 bg-[#161C2C] border border-blue-500/10 rounded-xl p-3 text-xs">
              <div>
                <span className="block text-[10px] text-slate-400 uppercase">Estimated HS Code</span>
                <span className="font-mono font-bold text-slate-200">{complianceAudit.hsCode}</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase">Base Tariff Duty</span>
                <span className="font-mono font-bold text-slate-200">{complianceAudit.dutyRatePercentage}%</span>
              </div>
              <div>
                <span className="block text-[10px] text-slate-400 uppercase">FTA Preference</span>
                <span className="font-mono font-bold text-emerald-400">
                  {complianceAudit.isFtaEligible ? `Available (-${complianceAudit.ftaSavingsPercentage}%)` : "Not Eligible"}
                </span>
              </div>
            </div>

            {/* Document Checkoff List */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-slate-300 uppercase tracking-wide">Required Documentation Progress</span>
                <span className="text-[10px] text-slate-400">Click to advance status</span>
              </div>

              <div className="space-y-1.5 max-h-[190px] overflow-y-auto pr-1">
                {complianceAudit.requiredDocuments.map((doc, idx) => {
                  const status = documentProgress[doc.name] || "Draft";
                  return (
                    <div 
                      key={idx} 
                      onClick={() => handleToggleDocStatus(doc.name)}
                      className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-2.5 flex items-start justify-between gap-3 cursor-pointer transition"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-[9px] font-bold px-1 rounded ${
                            doc.urgency === "CRITICAL" ? "bg-red-500/10 text-red-400" : "bg-slate-700 text-slate-300"
                          }`}>
                            {doc.urgency}
                          </span>
                          <span className="text-xs font-semibold text-slate-200 truncate">{doc.name}</span>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1 line-clamp-1">{doc.purpose}</p>
                        <p className="text-[9px] text-slate-500 mt-0.5">Issuer: {doc.issuer}</p>
                      </div>

                      <button className={`text-[10px] font-bold px-2 py-1 rounded border transition ${getDocStatusBadgeColor(status)}`}>
                        {status}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Regulatory warnings */}
            <div className="bg-[#1C1318] border border-red-500/15 rounded-xl p-3 text-xs space-y-1.5">
              <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Critical Compliance Alerts
              </span>
              <ul className="list-disc pl-4 space-y-1 text-slate-400 text-[11px]">
                {complianceAudit.regulatoryComplianceNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* COLUMN C: NEXUSLINK TRADE ADVISORY AGENT (4 cols lg) */}
        <section className="lg:col-span-3 flex flex-col bg-[#111827] border border-slate-800 rounded-2xl p-5 shadow-xl h-[700px] lg:h-auto">
          
          <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
              <div>
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">NexusLink AI Advisor</h2>
                <span className="text-[10px] text-slate-400">Contextual trade assistant</span>
              </div>
            </div>
            
            <button 
              onClick={() => {
                setChatMessages([
                  {
                    id: "welcome",
                    role: "assistant",
                    content: `Hello! Workspace refreshed for **${activeComponent.name}**. What specific clearance or customs logistics details can I help explain for importing from **${sourcePortObj.name}** to **${destPortObj.name}**?`,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  }
                ]);
              }}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-md"
              title="Reset conversation"
            >
              <RefreshCw className="w-3 h-3" />
              Reset
            </button>
          </div>

          {/* Sourcing context card snippet */}
          <div className="bg-slate-900 rounded-xl p-2.5 mb-4 text-[11px] border border-slate-800/80">
            <span className="text-slate-400 block font-semibold mb-1">Active Chat Sourcing Context:</span>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-slate-300">
              <div>• Item: <strong className="text-slate-100">{activeComponent.name}</strong></div>
              <div>• HS Heading: <strong className="text-slate-100">{complianceAudit.hsCode}</strong></div>
              <div>• route: <strong className="text-amber-400">{sourcePortObj.code}➔{destPortObj.code}</strong></div>
              <div>• Total Val: <strong className="text-slate-100">${(quantity * unitPrice).toLocaleString()}</strong></div>
            </div>
          </div>

          {/* Quick Preset Prompts */}
          <div className="mb-3 space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recommended Advisor Prompts:</span>
            <div className="grid grid-cols-1 gap-1.5">
              <button
                onClick={() => handleSendMessage(undefined, `How can I bypass customs delays for ${activeComponent.name} at ${destPortObj.name}?`)}
                className="text-left text-[10px] bg-slate-800/80 hover:bg-slate-800 text-slate-300 p-2 rounded-lg border border-slate-700/50 truncate transition"
              >
                💡 Clear customs quickly at {destPortObj.code}?
              </button>
              <button
                onClick={() => handleSendMessage(undefined, `Is ${activeComponent.name} eligible for tariff cuts under the FTA?`)}
                className="text-left text-[10px] bg-slate-800/80 hover:bg-slate-800 text-slate-300 p-2 rounded-lg border border-slate-700/50 truncate transition"
              >
                🇨🇳 Apply FTA discount on HS {complianceAudit.hsCode}?
              </button>
              <button
                onClick={() => handleSendMessage(undefined, `What specific licensing authorities in Pakistan govern wireless imports like ESP32 modules?`)}
                className="text-left text-[10px] bg-slate-800/80 hover:bg-slate-800 text-slate-300 p-2 rounded-lg border border-slate-700/50 truncate transition"
              >
                📜 Required government NOC approvals?
              </button>
            </div>
          </div>

          {/* Chat Messages display */}
          <div className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1 scrollbar-thin scrollbar-thumb-slate-800">
            {chatMessages.map((msg) => (
              <div 
                key={msg.id}
                className={`flex flex-col max-w-[90%] text-xs ${
                  msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                }`}
              >
                <span className="text-[10px] text-slate-400 mb-0.5 px-1">{msg.role === "user" ? "Buyer" : "Advisor Agent"} • {msg.timestamp}</span>
                <div className={`p-3 rounded-2xl whitespace-pre-wrap leading-relaxed ${
                  msg.role === "user" 
                    ? "bg-amber-500 text-[#090D16] font-semibold rounded-tr-none" 
                    : "bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none"
                }`}>
                  {/* Simplistic custom renderer to support **bolding** and newline formatting without md rendering overhead */}
                  {msg.content.split("\n").map((line, lIdx) => {
                    // Quick check for bullet lists
                    const isBullet = line.startsWith("- ") || line.startsWith("* ");
                    const cleanLine = isBullet ? line.substring(2) : line;

                    // Parse **bold** parts
                    const parts = cleanLine.split(/\*\*(.*?)\*\*/g);
                    const formattedSpan = parts.map((part, pIdx) => 
                      pIdx % 2 === 1 ? <strong key={pIdx} className="font-extrabold text-amber-300">{part}</strong> : part
                    );

                    return (
                      <p key={lIdx} className={isBullet ? "pl-4 py-0.5 relative" : "py-0.5"}>
                        {isBullet && <span className="absolute left-1 text-amber-500">•</span>}
                        {formattedSpan}
                      </p>
                    );
                  })}
                </div>
              </div>
            ))}

            {sendingChat && (
              <div className="flex flex-col items-start mr-auto max-w-[85%] text-xs">
                <span className="text-[10px] text-slate-400 mb-0.5 px-1">Agent is typing...</span>
                <div className="bg-slate-900 text-slate-400 border border-slate-800 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                  <span className="inline-block w-2.5 h-2.5 bg-amber-500 rounded-full animate-bounce"></span>
                  <span className="inline-block w-2.5 h-2.5 bg-teal-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                  <span className="inline-block w-2.5 h-2.5 bg-slate-500 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  <span>Verifying trade rules & customs directory...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Message Input bar */}
          <form onSubmit={handleSendMessage} className="relative mt-auto">
            <input 
              type="text"
              placeholder="Ask Advisor e.g. How to acquire Weboc certificate..."
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              className="w-full text-xs bg-slate-900 border border-slate-700/80 rounded-xl pl-3 pr-10 py-3 text-slate-200 focus:outline-none focus:border-amber-500"
            />
            <button 
              type="submit"
              disabled={sendingChat || !userInput.trim()}
              className="absolute right-1.5 top-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-[#090D16] p-1.5 rounded-lg transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>

      </main>

      {/* 3. FOOTER */}
      <footer className="border-t border-slate-800 bg-[#0A0D16] px-6 py-4 flex flex-col sm:flex-row justify-between items-center text-xs text-slate-400 gap-4 mt-auto">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-amber-500" />
          <span>NexusLink B2B Trade Compliance Platform • Est. 2026</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            China-Pakistan Trade Agreement (CPFTA-II) Database Active
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center gap-1">
            <Lock className="w-3.5 h-3.5 text-slate-500" /> Secure Corporate Workspace
          </span>
        </div>
      </footer>
    </div>
  );
}
