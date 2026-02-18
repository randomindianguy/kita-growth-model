import { useState } from "react";

/* ───────── editable baseline assumptions ───────── */
const DEFAULT_ASSUMPTIONS = {
  customers: 15,
  arpu: 6,
  churnRate: 5,
  activationRate: 35,
  leadsPerMonth: 50,
  demoRate: 45,
  trialRate: 65,
  paidRate: 55,
  leadGrowthRate: 8,
};

/* Activation drives ~40% of new customer variance; the rest is sales effort,
   market timing, etc. Kept as an internal model parameter, not user-facing. */
const ACTIVATION_WEIGHT = 0.4;

const ASSUMPTION_META = {
  customers:       { label: "Current customers",  unit: "",  prefix: "",  step: 1,   min: 1,   max: 200, group: "business" },
  arpu:            { label: "ARPU",               unit: "K", prefix: "$", step: 0.5, min: 1,   max: 30,  group: "business" },
  churnRate:       { label: "Monthly churn",      unit: "%", prefix: "",  step: 0.5, min: 0.5, max: 15,  group: "business" },
  activationRate:  { label: "Activation rate",    unit: "%", prefix: "",  step: 5,   min: 10,  max: 90,  group: "business" },
  leadsPerMonth:   { label: "Leads / month",      unit: "",  prefix: "",  step: 5,   min: 10,  max: 500, group: "funnel" },
  demoRate:        { label: "Lead → Demo",        unit: "%", prefix: "",  step: 5,   min: 10,  max: 90,  group: "funnel" },
  trialRate:       { label: "Demo → Trial",       unit: "%", prefix: "",  step: 5,   min: 10,  max: 90,  group: "funnel" },
  paidRate:        { label: "Trial → Paid",       unit: "%", prefix: "",  step: 5,   min: 10,  max: 90,  group: "funnel" },
  leadGrowthRate:  { label: "Lead growth / mo",   unit: "%", prefix: "",  step: 1,   min: 0,   max: 30,  group: "funnel" },
};

/* ───────── growth levers ───────── */
const LEVERS = [
  {
    id: "churn",
    label: "Retention",
    subtitle: "Monthly churn rate",
    unit: "%",
    baseKey: "churnRate",
    targetValue: 2,
    min: 0.5,
    max: 10,
    step: 0.5,
    direction: "lower-is-better",
    insight: "Each percentage point of churn compounds monthly. At 5% monthly churn, you lose ~46% of your base in a year. At 2%, you keep ~78%. The gap widens every month — it's exponential, not linear.",
    tactics: [
      "Health Score dashboard: flag accounts when doc volume drops >30% MoM",
      "Recovery playbook: auto-email (Day 1) → call (Day 3) → incentive (Day 7) → founder outreach (Day 14)",
      "Monthly check-in emails showing ROI: fraud caught, hours saved, cost reduced — takes 10 min to personalize",
      "Weekly value reports: \"You caught 3 frauds worth ₱400K this week\""
    ],
    analogy: "Like a leaky bucket — you can pour water faster (acquire more), but plugging the holes (retention) is 3× more capital-efficient."
  },
  {
    id: "arpu",
    label: "Monetization",
    subtitle: "Average revenue per user",
    unit: "K",
    prefix: "$",
    baseKey: "arpu",
    targetValue: 9,
    min: 2,
    max: 20,
    step: 0.5,
    direction: "higher-is-better",
    insight: "If Kita catches $100K/year in fraud for a customer, a $20K/year price (20% of value delivered) is entirely defensible. A Van Westendorp survey on your current customer base will reveal the actual acceptable range — most B2B infra companies are underpriced early on.",
    tactics: [
      "Run Van Westendorp pricing survey to find your actual acceptable price range",
      "Structure Good-Better-Best tiers using MaxDiff feature ranking from customers",
      "Expand within accounts: bank statements → payslips, utility bills, tax docs",
      "Proactive outreach when customers hit 80% of their tier volume limit"
    ],
    analogy: "Like a gym membership — some members only use the treadmill. Show them the pool, the classes, the sauna. Same customer, 3× the value captured."
  },
  {
    id: "activation",
    label: "Activation",
    subtitle: "% reaching Aha! in 14 days",
    unit: "%",
    baseKey: "activationRate",
    targetValue: 60,
    min: 10,
    max: 90,
    step: 5,
    direction: "higher-is-better",
    insight: "Every customer that doesn't activate is acquisition spend wasted. The typical drop-off in developer-facing B2B products is at integration — going from \"signed\" to \"actually running in production.\" Reducing that friction directly multiplies your funnel efficiency.",
    tactics: [
      "White-glove setup call within 48 hours of contract signing",
      "Integration wizard: auto-configure API + code samples by document type",
      "\"Test mode\" with dummy data — zero real integration needed to see value",
      "\"First 1,000 docs free\" to de-risk the integration investment"
    ],
    analogy: "Like a restaurant where most customers leave before tasting the food. The kitchen is great — the problem is the 45-minute wait for a table."
  }
];

/* ───────── model math ───────── */
function calculateMRR(assumptions, churnOverride, arpuOverride, activationOverride, month) {
  const churn = churnOverride ?? assumptions.churnRate;
  const arpu = arpuOverride ?? assumptions.arpu;
  const activation = activationOverride ?? assumptions.activationRate;
  const activationRatio = activation / assumptions.activationRate;
  const w = ACTIVATION_WEIGHT;

  let customers = assumptions.customers;
  for (let m = 1; m <= month; m++) {
    const leads = assumptions.leadsPerMonth * Math.pow(1 + assumptions.leadGrowthRate / 100, m);
    const newCustomers = leads
      * (assumptions.demoRate / 100)
      * (assumptions.trialRate / 100)
      * (assumptions.paidRate / 100)
      * (activationRatio * w + (1 - w));
    const retained = customers * (1 - churn / 100);
    customers = retained + newCustomers;
  }
  return Math.round(customers * arpu * 1000);
}

function calcIndependentImpact(assumptions, leverId, value) {
  const baseMRR = calculateMRR(assumptions, assumptions.churnRate, assumptions.arpu, assumptions.activationRate, 12);
  const o = { churn: assumptions.churnRate, arpu: assumptions.arpu, activation: assumptions.activationRate };
  o[leverId] = value;
  const newMRR = calculateMRR(assumptions, o.churn, o.arpu, o.activation, 12);
  return Math.round(((newMRR - baseMRR) / baseMRR) * 100);
}

function formatMRR(value) {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value}`;
}

/* ───────── dynamic insight generator ───────── */
function generateCoreInsight(assumptions, churn, arpu, activation) {
  const impacts = [
    { label: "retention", pct: Math.abs(calcIndependentImpact(assumptions, "churn", churn)), leverId: "churn" },
    { label: "monetization", pct: Math.abs(calcIndependentImpact(assumptions, "arpu", arpu)), leverId: "arpu" },
    { label: "activation", pct: Math.abs(calcIndependentImpact(assumptions, "activation", activation)), leverId: "activation" },
  ].sort((a, b) => b.pct - a.pct);

  const modified = impacts.filter(i => i.pct > 0);

  if (modified.length === 0) {
    const targetImpacts = [
      { label: "retention", pct: Math.abs(calcIndependentImpact(assumptions, "churn", 2)) },
      { label: "monetization", pct: Math.abs(calcIndependentImpact(assumptions, "arpu", 9)) },
      { label: "activation", pct: Math.abs(calcIndependentImpact(assumptions, "activation", 60)) },
    ].sort((a, b) => b.pct - a.pct);
    const top = targetImpacts[0];
    const second = targetImpacts[1];
    return `At these baselines, ${top.label} (+${top.pct}%) and ${second.label} (+${second.pct}%) have the largest upside at their target values. Drag the sliders to explore.`;
  }

  const top = modified[0];
  if (modified.length === 1) {
    return `With your current adjustments, ${top.label} is driving all the MRR movement (+${top.pct}%). Try combining levers — the effects multiply.`;
  }
  const acqImpact = modified.find(i => i.leverId === "activation");
  const retMonImpact = modified.filter(i => i.leverId !== "activation");
  if (retMonImpact.length >= 2 && acqImpact && retMonImpact.reduce((s, i) => s + i.pct, 0) > acqImpact.pct * 1.5) {
    return `Retention + monetization are driving ${retMonImpact.reduce((s, i) => s + i.pct, 0)}% combined uplift vs ${acqImpact.pct}% from activation alone. Fixing the bucket matters more than pouring faster.`;
  }
  return `Largest lever: ${top.label} at +${top.pct}%. ${modified.length > 1 ? `Combined with ${modified[1].label} (+${modified[1].pct}%), these compound — the chart reflects their multiplicative effect.` : ""}`;
}

/* ───────── small components ───────── */
function AssumptionInput({ id, meta, value, onChange }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
      gap: 12,
    }}>
      <label style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", whiteSpace: "nowrap" }}>
        {meta.label}
      </label>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 4, width: 110, flexShrink: 0 }}>
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", minWidth: 10, textAlign: "right" }}>{meta.prefix}</span>
        <input type="number" value={value} min={meta.min} max={meta.max} step={meta.step}
          onChange={(e) => onChange(id, parseFloat(e.target.value) || 0)}
          style={{
            width: 64, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 6, padding: "5px 10px", color: "#fff", fontSize: 13,
            fontFamily: "'DM Sans', sans-serif", fontWeight: 600, textAlign: "right", outline: "none",
          }}
          onFocus={(e) => e.target.style.borderColor = "rgba(107,142,80,0.5)"}
          onBlur={(e) => e.target.style.borderColor = "rgba(255,255,255,0.1)"}
        />
        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", minWidth: 14 }}>{meta.unit}</span>
      </div>
    </div>
  );
}

function MRRChart({ assumptions, churn, arpu, activation }) {
  const months = [0, 3, 6, 9, 12, 15, 18];
  const baseline = months.map(m => calculateMRR(assumptions, assumptions.churnRate, assumptions.arpu, assumptions.activationRate, m));
  const projected = months.map(m => calculateMRR(assumptions, churn, arpu, activation, m));
  const maxVal = Math.max(...projected, ...baseline) * 1.08;
  const chartH = 160;

  return (
    <div style={{ position: "relative", height: chartH + 40, width: "100%", marginTop: 12 }}>
      <svg width="100%" height={chartH + 40} viewBox={`0 0 400 ${chartH + 40}`} preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => (
          <line key={i} x1="0" x2="400" y1={chartH - pct * chartH} y2={chartH - pct * chartH}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        ))}
        <polyline
          points={months.map((m, i) => `${(i / (months.length - 1)) * 390 + 5},${chartH - (baseline[i] / maxVal) * (chartH - 10)}`).join(" ")}
          fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="2" strokeDasharray="6,4"
        />
        <polygon
          points={`5,${chartH} ${months.map((m, i) => `${(i / (months.length - 1)) * 390 + 5},${chartH - (projected[i] / maxVal) * (chartH - 10)}`).join(" ")} 395,${chartH}`}
          fill="url(#greenGrad)"
        />
        <polyline
          points={months.map((m, i) => `${(i / (months.length - 1)) * 390 + 5},${chartH - (projected[i] / maxVal) * (chartH - 10)}`).join(" ")}
          fill="none" stroke="rgba(107,142,80,0.8)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        />
        {months.map((m, i) => (
          <circle key={i}
            cx={(i / (months.length - 1)) * 390 + 5}
            cy={chartH - (projected[i] / maxVal) * (chartH - 10)}
            r="3.5" fill="#1a2318" stroke="rgba(107,142,80,0.8)" strokeWidth="2"
          />
        ))}
        {months.map((m, i) => (
          <text key={i} x={(i / (months.length - 1)) * 390 + 5} y={chartH + 18}
            textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="10" fontFamily="DM Sans, sans-serif">
            M{m}
          </text>
        ))}
        {(() => {
          const projY = chartH - (projected[6] / maxVal) * (chartH - 10) - 10;
          const baseY = chartH - (baseline[6] / maxVal) * (chartH - 10) - 10;
          const tooClose = Math.abs(projY - baseY) < 18;
          const same = formatMRR(projected[6]) === formatMRR(baseline[6]);
          return (
            <>
              <text x={395} y={same ? projY : projY} textAnchor="end"
                fill="rgba(107,142,80,0.9)" fontSize="13" fontWeight="700" fontFamily="DM Sans, sans-serif">
                {formatMRR(projected[6])}
              </text>
              {!same && (
                <text x={395} y={tooClose ? baseY + 18 : baseY} textAnchor="end"
                  fill="rgba(255,255,255,0.3)" fontSize="11" fontFamily="DM Sans, sans-serif">
                  {formatMRR(baseline[6])} baseline
                </text>
              )}
            </>
          );
        })()}
        <defs>
          <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(107,142,80,0.2)" />
            <stop offset="100%" stopColor="rgba(107,142,80,0)" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}

function LeverCard({ lever, value, baseValue, onChange, isExpanded, onToggle, assumptions }) {
  const impactPct = calcIndependentImpact(assumptions, lever.id, value);

  const potentialPct = calcIndependentImpact(assumptions, lever.id, lever.targetValue);

  const isAtBaseline = value === baseValue;

  return (
    <div style={{
      background: isExpanded ? "rgba(107, 142, 80, 0.08)" : "rgba(255,255,255,0.03)",
      border: isExpanded ? "1px solid rgba(107, 142, 80, 0.3)" : "1px solid rgba(255,255,255,0.08)",
      borderRadius: 16, padding: isExpanded ? 28 : 24,
      cursor: "pointer", transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    }}>
      <div onClick={onToggle}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 13, color: "rgba(107,142,80,0.9)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 6 }}>
              {lever.label}
            </div>
            <div style={{ fontSize: 15, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif" }}>
              {lever.subtitle}
            </div>
          </div>
          <div style={{ fontSize: 32, fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#fff", lineHeight: 1 }}>
            {lever.prefix || ""}{value}{lever.unit}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: isExpanded ? 20 : 0 }}>
          {isAtBaseline ? (
            <div style={{
              fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
              color: "rgba(107,142,80,0.5)",
            }}>
              Up to {potentialPct > 0 ? "+" : ""}{potentialPct}% MRR if improved to {lever.prefix || ""}{lever.targetValue}{lever.unit}
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                color: impactPct > 0 ? "rgba(107,180,80,0.9)" : impactPct < 0 ? "rgba(200,100,80,0.9)" : "rgba(255,255,255,0.4)",
              }}>
                {impactPct > 0 ? "+" : ""}{impactPct}% Month 12 MRR
              </div>
              <div style={{
                fontSize: 10, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif",
                background: "rgba(255,255,255,0.05)", borderRadius: 4, padding: "2px 6px",
              }}>
                this lever alone
              </div>
            </div>
          )}
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif", marginLeft: "auto" }}>
            {isExpanded ? "↑" : "↓"}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div style={{ animation: "fadeSlideIn 0.4s ease" }}>
          <div style={{ marginBottom: 24, padding: "0 4px" }}>
            <input type="range" min={lever.min} max={lever.max} step={lever.step} value={value}
              onChange={(e) => onChange(parseFloat(e.target.value))}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%", height: 6, borderRadius: 3, appearance: "none",
                background: `linear-gradient(to right, rgba(107,142,80,0.7) 0%, rgba(107,142,80,0.7) ${((value - lever.min) / (lever.max - lever.min)) * 100}%, rgba(255,255,255,0.1) ${((value - lever.min) / (lever.max - lever.min)) * 100}%, rgba(255,255,255,0.1) 100%)`,
                outline: "none", cursor: "pointer",
              }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                {lever.prefix || ""}{lever.min}{lever.unit}
              </span>
              <span style={{ fontSize: 11, color: "rgba(107,142,80,0.6)", fontFamily: "'DM Sans', sans-serif", fontWeight: 600 }}>
                Your baseline: {lever.prefix || ""}{baseValue}{lever.unit} → Suggested: {lever.prefix || ""}{lever.targetValue}{lever.unit}
              </span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif" }}>
                {lever.prefix || ""}{lever.max}{lever.unit}
              </span>
            </div>
          </div>

          <div style={{ background: "rgba(0,0,0,0.2)", borderRadius: 12, padding: 18, marginBottom: 16, borderLeft: "3px solid rgba(107,142,80,0.5)" }}>
            <div style={{ fontSize: 11, color: "rgba(107,142,80,0.8)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Why This Matters
            </div>
            <div style={{ fontSize: 14, color: "rgba(255,255,255,0.7)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
              {lever.insight}
            </div>
          </div>

          <div style={{ background: "rgba(255,255,255,0.02)", borderRadius: 12, padding: 16, marginBottom: 16, borderLeft: "2px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.6 }}>
              {lever.analogy}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 11, color: "rgba(107,142,80,0.8)", fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
              Recommended Tactics
            </div>
            {lever.tactics.map((tactic, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 10 }}>
                <div style={{
                  width: 20, height: 20, minWidth: 20, borderRadius: 6,
                  background: "rgba(107,142,80,0.15)", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, color: "rgba(107,142,80,0.8)", fontFamily: "'DM Sans', sans-serif", fontWeight: 700, marginTop: 1,
                }}>{i + 1}</div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", fontFamily: "'DM Sans', sans-serif", lineHeight: 1.5 }}>
                  {tactic}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── main app ───────── */
export default function KitaGrowthEngine() {
  const [assumptions, setAssumptions] = useState(DEFAULT_ASSUMPTIONS);
  const [assumptionsOpen, setAssumptionsOpen] = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [churn, setChurn] = useState(null);
  const [arpu, setArpu] = useState(null);
  const [activation, setActivation] = useState(null);

  const effectiveChurn = churn ?? assumptions.churnRate;
  const effectiveArpu = arpu ?? assumptions.arpu;
  const effectiveActivation = activation ?? assumptions.activationRate;

  const handleAssumptionChange = (key, val) => {
    setAssumptions(prev => ({ ...prev, [key]: val }));
    if (key === "churnRate") setChurn(null);
    if (key === "arpu") setArpu(null);
    if (key === "activationRate") setActivation(null);
  };

  const baseMRR12 = calculateMRR(assumptions, assumptions.churnRate, assumptions.arpu, assumptions.activationRate, 12);
  const projMRR12 = calculateMRR(assumptions, effectiveChurn, effectiveArpu, effectiveActivation, 12);
  const mrrLift = Math.round(((projMRR12 - baseMRR12) / baseMRR12) * 100);
  const isModified = churn !== null || arpu !== null || activation !== null;

  const assumptionsEdited = JSON.stringify(assumptions) !== JSON.stringify(DEFAULT_ASSUMPTIONS);

  const computedMRR = Math.round(assumptions.customers * assumptions.arpu * 1000);

  const hitAllTargets = () => { setChurn(2); setArpu(9); setActivation(60); };

  const coreInsight = generateCoreInsight(assumptions, effectiveChurn, effectiveArpu, effectiveActivation);

  const businessKeys = Object.entries(ASSUMPTION_META).filter(([, m]) => m.group === "business").map(([k]) => k);
  const funnelKeys = Object.entries(ASSUMPTION_META).filter(([, m]) => m.group === "funnel").map(([k]) => k);

  return (
    <div style={{
      minHeight: "100vh", background: "#1a2318", color: "#fff",
      fontFamily: "'DM Sans', sans-serif", position: "relative",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none; width: 20px; height: 20px; border-radius: 50%;
          background: #6B8E50; border: 3px solid #1a2318; cursor: pointer;
          box-shadow: 0 0 10px rgba(107,142,80,0.4);
        }
        input[type="number"]::-webkit-inner-spin-button,
        input[type="number"]::-webkit-outer-spin-button { appearance: none; margin: 0; }
        input[type="number"] { -moz-appearance: textfield; }
        @keyframes fadeSlideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>

      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "radial-gradient(ellipse at 20% 0%, rgba(107,142,80,0.06) 0%, transparent 60%), radial-gradient(ellipse at 80% 100%, rgba(107,142,80,0.04) 0%, transparent 60%)",
        pointerEvents: "none",
      }} />

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "40px 20px 60px", position: "relative" }}>

        {/* Header */}
        <div style={{ marginBottom: 32, animation: "fadeIn 0.6s ease" }}>
          <div style={{ fontSize: 13, color: "rgba(107,142,80,0.7)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12, fontWeight: 500 }}>
            Growth Analysis
          </div>
          <h1 style={{
            fontFamily: "'Playfair Display', serif", fontSize: "clamp(28px, 5vw, 38px)",
            fontWeight: 700, lineHeight: 1.15, marginBottom: 14, color: "#fff",
          }}>
            The levers that move{" "}
            <span style={{ color: "rgba(107,142,80,0.9)" }}>Kita's MRR.</span>
          </h1>
          <p style={{ fontSize: 15, color: "rgba(255,255,255,0.45)", lineHeight: 1.65, maxWidth: 520 }}>
            An interactive model of Kita's growth engine. Start by checking the assumptions, 
            then tap each lever to see the strategy — and drag sliders to see how the numbers move.
          </p>
        </div>

        {/* ── ASSUMPTIONS PANEL ── */}
        <div style={{
          background: assumptionsOpen ? "rgba(200,170,80,0.06)" : "rgba(200,170,80,0.04)",
          border: assumptionsOpen ? "1px solid rgba(200,170,80,0.25)" : "1px solid rgba(200,170,80,0.12)",
          borderRadius: 14, marginBottom: 28, overflow: "hidden",
          transition: "all 0.3s ease", animation: "fadeIn 0.7s ease",
        }}>
          <div
            onClick={() => setAssumptionsOpen(!assumptionsOpen)}
            style={{
              padding: "16px 20px", cursor: "pointer",
              display: "flex", justifyContent: "space-between", alignItems: "center",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(200,170,80,0.12)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, color: "rgba(200,170,80,0.8)", fontWeight: 700, fontFamily: "'DM Sans', sans-serif",
              }}>A</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "rgba(200,170,80,0.9)" }}>
                  Assumptions{assumptionsEdited ? " (edited)" : ""}
                </div>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.35)", marginTop: 2 }}>
                  {assumptionsOpen
                    ? `Implied MRR: ${formatMRR(computedMRR)} (${assumptions.customers} customers × $${assumptions.arpu}K ARPU)`
                    : "Tap to review & edit the baseline numbers"
                  }
                </div>
              </div>
            </div>
            <div style={{
              fontSize: 12, color: "rgba(200,170,80,0.6)",
              transform: assumptionsOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.3s ease",
            }}>▼</div>
          </div>

          {assumptionsOpen && (
            <div style={{ padding: "0 20px 20px", animation: "fadeSlideIn 0.3s ease" }}>
              <div style={{
                background: "rgba(200,170,80,0.06)", borderRadius: 10, padding: "10px 14px", marginBottom: 16,
                border: "1px dashed rgba(200,170,80,0.15)",
              }}>
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", lineHeight: 1.6 }}>
                  These numbers are illustrative estimates based on publicly available context and typical Series A fintech benchmarks.
                  <span style={{ color: "rgba(200,170,80,0.8)", fontWeight: 600 }}> Edit any value</span> to calibrate with your actual metrics — all projections recalculate instantly.
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 32px", alignItems: "start" }}>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, paddingTop: 4 }}>
                    Business Metrics
                  </div>
                  {businessKeys.map(key => (
                    <AssumptionInput key={key} id={key} meta={ASSUMPTION_META[key]} value={assumptions[key]} onChange={handleAssumptionChange} />
                  ))}
                </div>
                <div>
                  <div style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8, paddingTop: 4 }}>
                    Funnel Metrics
                  </div>
                  {funnelKeys.map(key => (
                    <AssumptionInput key={key} id={key} meta={ASSUMPTION_META[key]} value={assumptions[key]} onChange={handleAssumptionChange} />
                  ))}
                </div>
              </div>

              {assumptionsEdited && (
                <div style={{ textAlign: "right", marginTop: 12 }}>
                  <button onClick={() => { setAssumptions(DEFAULT_ASSUMPTIONS); setChurn(null); setArpu(null); setActivation(null); }}
                    style={{
                      background: "none", border: "1px solid rgba(200,170,80,0.2)", color: "rgba(200,170,80,0.6)",
                      padding: "5px 14px", borderRadius: 6, cursor: "pointer", fontSize: 11, fontFamily: "'DM Sans', sans-serif",
                    }}>
                    Reset to defaults
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── MRR SUMMARY ── */}
        <div style={{
          background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 16, padding: "24px 28px", marginBottom: 16, animation: "fadeIn 0.8s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
            <div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 8 }}>
                Projected Month 12 MRR
              </div>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: 42, fontWeight: 800,
                color: "#fff", lineHeight: 1, transition: "all 0.3s ease",
              }}>
                {formatMRR(projMRR12)}
              </div>
            </div>
            {isModified && (
              <div style={{
                background: mrrLift > 0 ? "rgba(107,142,80,0.15)" : "rgba(200,100,80,0.15)",
                borderRadius: 8, padding: "6px 12px", animation: "fadeIn 0.3s ease",
              }}>
                <div style={{
                  fontSize: 16, fontWeight: 700,
                  color: mrrLift > 0 ? "rgba(130,180,90,0.9)" : "rgba(200,100,80,0.9)",
                  fontFamily: "'DM Sans', sans-serif",
                }}>
                  {mrrLift > 0 ? "+" : ""}{mrrLift}%
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>vs baseline</div>
              </div>
            )}
          </div>

          {isModified && (
            <div style={{
              fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 8, marginBottom: -4,
              fontFamily: "'DM Sans', sans-serif", fontStyle: "italic",
            }}>
              Chart reflects all active levers combined — effects are multiplicative
            </div>
          )}

          <MRRChart assumptions={assumptions} churn={effectiveChurn} arpu={effectiveArpu} activation={effectiveActivation} />

          <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 2, background: "rgba(107,142,80,0.8)", borderRadius: 1 }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Your scenario</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 16, height: 0, borderTop: "2px dashed rgba(255,255,255,0.15)" }} />
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>Baseline</span>
            </div>
          </div>
        </div>

        {/* ── HIT ALL TARGETS + RESET ── */}
        <div style={{ display: "flex", gap: 10, marginBottom: 28, animation: "fadeIn 0.9s ease" }}>
          <button onClick={hitAllTargets}
            style={{
              flex: 1, background: "rgba(107,142,80,0.1)", border: "1px solid rgba(107,142,80,0.2)",
              color: "rgba(107,142,80,0.8)", padding: "10px 16px", borderRadius: 10,
              cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => { e.target.style.background = "rgba(107,142,80,0.18)"; }}
            onMouseLeave={(e) => { e.target.style.background = "rgba(107,142,80,0.1)"; }}
          >
            Hit all targets
          </button>
          {isModified && (
            <button onClick={() => { setChurn(null); setArpu(null); setActivation(null); }}
              style={{
                background: "none", border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.35)", padding: "10px 16px", borderRadius: 10,
                cursor: "pointer", fontSize: 13, fontFamily: "'DM Sans', sans-serif",
                animation: "fadeIn 0.3s ease",
              }}>
              Reset
            </button>
          )}
        </div>

        {/* ── DYNAMIC CORE INSIGHT ── */}
        <div style={{
          background: "rgba(107,142,80,0.08)", border: "1px solid rgba(107,142,80,0.15)",
          borderRadius: 12, padding: "14px 18px", marginBottom: 28, animation: "fadeIn 1s ease",
          transition: "all 0.3s ease",
        }}>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 1.6 }}>
            <span style={{ color: "rgba(107,142,80,0.9)", fontWeight: 600 }}>Insight: </span>
            {coreInsight}
          </div>
        </div>

        {/* ── LEVER CARDS ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {LEVERS.map((lever) => {
            const currentVal = lever.id === "churn" ? effectiveChurn : lever.id === "arpu" ? effectiveArpu : effectiveActivation;
            const setter = lever.id === "churn" ? setChurn : lever.id === "arpu" ? setArpu : setActivation;
            return (
              <LeverCard key={lever.id} lever={lever} value={currentVal}
                baseValue={assumptions[lever.baseKey]}
                onChange={setter} isExpanded={expanded === lever.id}
                onToggle={() => setExpanded(expanded === lever.id ? null : lever.id)}
                assumptions={assumptions}
              />
            );
          })}
        </div>

        {/* ── 30-DAY PLAN ── */}
        <div style={{ marginTop: 48, animation: "fadeIn 1.1s ease" }}>
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: "rgba(107,142,80,0.7)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10, fontWeight: 500 }}>
              If I were on the team
            </div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif", fontSize: "clamp(22px, 4vw, 28px)",
              fontWeight: 700, lineHeight: 1.2, color: "#fff", marginBottom: 10,
            }}>
              What I'd ship in <span style={{ color: "rgba(107,142,80,0.9)" }}>30 days.</span>
            </h2>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", lineHeight: 1.6 }}>
              Three scoped initiatives tied to the levers above — ranked by remaining upside. Drag the sliders and watch the priorities shift.
            </p>
          </div>

          {(() => {
            const planItems = [
              {
                leverId: "churn",
                lever: "Retention",
                title: "Build an automated early-warning system for churn",
                what: "Design a lightweight health score that runs off existing product data — doc volume trends, login frequency, error rates. Wire it to automated email triggers so at-risk accounts get a nudge without anyone manually monitoring a dashboard. Two founders can't play customer success for 15+ accounts — the system has to do the watching.",
                deliverable: "Health score logic + automated email sequences (built in product or a simple tool like Customer.io)",
                metric: "Catch at-risk accounts 14 days before they'd otherwise go silent",
              },
              {
                leverId: "activation",
                lever: "Activation",
                title: "Cut the integration drop-off in half",
                what: "Map the current onboarding funnel with real data, identify the exact step where the biggest drop happens, and design a self-serve integration wizard that auto-configures the API based on document types. Add a \"test mode\" with dummy data so prospects see value before writing a single line of code. The goal: get customers to Aha! without needing a founder on a call every time.",
                deliverable: "Funnel analysis + integration wizard PRD + test mode prototype",
                metric: "Activation rate from 35% → 50% within the first cohort",
              },
              {
                leverId: "arpu",
                lever: "Monetization",
                title: "Run the pricing research that unlocks ARPU",
                what: "Deploy a Van Westendorp survey to existing customers to find the actual acceptable price range. Run a MaxDiff survey to rank which features customers value most. Use both to draft a Good-Better-Best tier structure. This is a one-time research sprint that pays for itself — you only need to do it once to know if you're leaving money on the table.",
                deliverable: "Pricing research report + proposed tier structure + migration plan for existing customers",
                metric: "Confirm whether current pricing sits below the Point of Marginal Cheapness",
              },
            ];

            const upsides = planItems.map(item => {
              const target = LEVERS.find(l => l.id === item.leverId).targetValue;
              return {
                ...item,
                upside: Math.abs(calcIndependentImpact(assumptions, item.leverId, target)),
                currentImpact: Math.abs(calcIndependentImpact(assumptions, item.leverId,
                  item.leverId === "churn" ? effectiveChurn : item.leverId === "arpu" ? effectiveArpu : effectiveActivation
                )),
              };
            });

            const remainingUpside = upsides.map(item => ({
              ...item,
              remaining: Math.max(0, item.upside - item.currentImpact),
            })).sort((a, b) => b.remaining - a.remaining);

            const weekLabels = ["Week 1–2", "Week 2–3", "Week 3–4"];

            return remainingUpside.map((item, i) => (
              <div key={item.leverId} style={{
                background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14, padding: 22, marginBottom: 14,
                opacity: item.remaining === 0 ? 0.5 : 1,
                transition: "all 0.4s ease",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
                  <div style={{
                    fontSize: 11, color: "rgba(107,142,80,0.8)", fontFamily: "'DM Sans', sans-serif",
                    background: "rgba(107,142,80,0.1)", borderRadius: 6, padding: "3px 8px",
                    fontWeight: 600, letterSpacing: "0.04em",
                  }}>
                    {weekLabels[i]}
                  </div>
                  <div style={{
                    fontSize: 11, color: "rgba(255,255,255,0.3)", fontFamily: "'DM Sans', sans-serif",
                    background: "rgba(255,255,255,0.05)", borderRadius: 6, padding: "3px 8px",
                  }}>
                    {item.lever} lever
                  </div>
                  {item.remaining > 0 ? (
                    <div style={{
                      fontSize: 11, color: "rgba(107,180,80,0.7)", fontFamily: "'DM Sans', sans-serif",
                      marginLeft: "auto",
                    }}>
                      +{item.remaining}% MRR upside remaining
                    </div>
                  ) : (
                    <div style={{
                      fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'DM Sans', sans-serif",
                      fontStyle: "italic", marginLeft: "auto",
                    }}>
                      Already at or past target
                    </div>
                  )}
                </div>
                <div style={{
                  fontSize: 16, fontWeight: 600, color: "#fff", fontFamily: "'DM Sans', sans-serif",
                  lineHeight: 1.35, marginBottom: 10,
                }}>
                  {item.title}
                </div>
                <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", lineHeight: 1.65, marginBottom: 14 }}>
                  {item.what}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{
                      fontSize: 10, color: "rgba(107,142,80,0.7)", fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                      minWidth: 72, paddingTop: 1,
                    }}>
                      Deliverable
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                      {item.deliverable}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{
                      fontSize: 10, color: "rgba(107,142,80,0.7)", fontFamily: "'DM Sans', sans-serif",
                      fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase",
                      minWidth: 72, paddingTop: 1,
                    }}>
                      Success
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", lineHeight: 1.5 }}>
                      {item.metric}
                    </div>
                  </div>
                </div>
              </div>
            ));
          })()}
        </div>

        {/* ── AUTHOR CARD ── */}
        <div style={{
          marginTop: 40, background: "rgba(107,142,80,0.06)",
          border: "1px solid rgba(107,142,80,0.15)", borderRadius: 16,
          padding: 28, animation: "fadeIn 1.2s ease",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ fontSize: 11, color: "rgba(107,142,80,0.7)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 10, fontWeight: 500 }}>
                Built by
              </div>
              <div style={{
                fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700,
                color: "#fff", marginBottom: 6,
              }}>
                Sidharth Sundaram
              </div>
              <div style={{ fontSize: 13, color: "rgba(255,255,255,0.45)", lineHeight: 1.6, marginBottom: 16 }}>
                Product manager with 4 years in EdTech, now pursuing an MS in Engineering Management at Purdue. 
                I think in systems — connecting business strategy, user behavior, and what actually ships. 
                Built this to show how I'd approach growth at Kita, not just analyze it.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <a href="mailto:sundar84@purdue.edu" style={{
                  fontSize: 13, color: "rgba(107,142,80,0.9)", textDecoration: "none",
                  background: "rgba(107,142,80,0.1)", border: "1px solid rgba(107,142,80,0.2)",
                  borderRadius: 8, padding: "8px 16px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                  transition: "all 0.2s ease", display: "inline-block",
                }}>
                  sundar84@purdue.edu
                </a>
                <a href="https://www.linkedin.com/in/sidharthsundaram/" target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "8px 16px", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.2s ease", display: "inline-block",
                }}>
                  LinkedIn ↗
                </a>
                <a href="https://sidharthsundaram.com/" target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 13, color: "rgba(255,255,255,0.5)", textDecoration: "none",
                  background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8, padding: "8px 16px", fontFamily: "'DM Sans', sans-serif",
                  transition: "all 0.2s ease", display: "inline-block",
                }}>
                  Portfolio ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div style={{ marginTop: 48, padding: "24px 0", borderTop: "1px solid rgba(255,255,255,0.06)", animation: "fadeIn 1.2s ease" }}>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>
            Methodology
          </div>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)", lineHeight: 1.7 }}>
            Baseline assumptions are illustrative estimates drawn from publicly available context (YC listing, website, 
            industry benchmarks). The model compounds retention monthly and grows leads at the specified rate. 
            Activation is modeled as driving ~40% of new customer conversion variance, with the remainder attributed to 
            sales effort, market timing, and other factors. 
            Lever cards show independent effects (one lever changed, others at baseline). The MRR chart shows the combined 
            scenario — combined effects are multiplicative, not additive.
          </div>
          <div style={{ fontSize: 12, color: "rgba(107,142,80,0.5)", marginTop: 16, fontStyle: "italic" }}>
            Built as a growth analysis exercise — not affiliated with Kita.
          </div>
        </div>
      </div>
    </div>
  );
}
