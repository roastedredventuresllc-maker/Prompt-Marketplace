import { db } from "@workspace/db";
import { promptsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// The system account that authors all seeded prompts
const SYSTEM_USER = {
  username: "promptly",
  displayName: "Promptly",
  bio: "Curated starter prompts from the Promptly team.",
  orgType: "individual" as const,
};

const SEED_PROMPTS: Array<{
  title: string;
  description: string;
  content: string;
  categoryId: number;
  tags: string[];
}> = [
  // ── Finance (categoryId: 9) ─────────────────────────────────
  {
    title: "Investment Memo Generator",
    description: "Generate a structured investment memo for any asset, deal, or company.",
    content: `You are a senior investment analyst. Write a concise, professional investment memo for the following opportunity:

Asset / Company: {asset_name}
Asset Class: {asset_class}
Proposed Investment: {investment_size}

Include:
1. Executive Summary (2–3 sentences)
2. Investment Thesis (3 bullet points)
3. Key Risks & Mitigants
4. Comparable Transactions or Benchmarks
5. Recommended Next Steps

Use precise financial language. Be objective — highlight both upside and downside clearly.`,
    categoryId: 9,
    tags: ["finance", "investing", "memo", "due-diligence"],
  },
  {
    title: "Portfolio Risk Assessment",
    description: "Analyze concentration risk, volatility exposure, and diversification gaps in a portfolio.",
    content: `You are a portfolio risk manager. Analyze the following portfolio for risk:

Portfolio Holdings: {holdings_list}
Total Portfolio Value: {portfolio_value}
Investment Horizon: {horizon}
Risk Tolerance: {risk_tolerance}

Provide:
1. Concentration Analysis — identify overweight positions or sectors
2. Correlation Risk — flag assets that move together
3. Tail Risk Scenarios — 3 macro scenarios and their estimated impact
4. Diversification Recommendations — specific actions to improve the risk profile

Be direct and quantitative where possible.`,
    categoryId: 9,
    tags: ["finance", "risk", "portfolio", "investing"],
  },
  {
    title: "Earnings Call Key Takeaways",
    description: "Extract the most important insights from any earnings call transcript.",
    content: `You are an equity analyst. Read the following earnings call transcript and extract the most important information:

Transcript: {transcript}

Output:
1. Headline Numbers — Revenue, EPS, and key segment results vs. estimates
2. Management Tone — Bullish, neutral, or cautious? Quote supporting phrases.
3. Guidance Changes — Any raised, lowered, or withdrawn guidance
4. Key Risks Mentioned — Explicitly or between the lines
5. Analyst Q&A Themes — What were analysts most focused on?
6. Your 3-Sentence Take — Would you Buy, Hold, or Sell after this call and why?

Bias toward actionable insights. Be concise.`,
    categoryId: 9,
    tags: ["finance", "equity", "earnings", "analysis"],
  },
  {
    title: "Financial Model Stress Test",
    description: "Stress-test the key assumptions in any financial model with bear, base, and bull scenarios.",
    content: `You are a financial modeling expert. Review the following model assumptions and run a structured stress test:

Model Purpose: {model_purpose}
Key Assumptions: {assumptions_list}
Base Case Revenue / EBITDA: {base_case}

Deliver:
1. Assumption Sensitivity Table — rank assumptions by impact on the bottom line
2. Bear Case — what breaks first and at what threshold?
3. Bull Case — what needs to go right simultaneously?
4. Red Flags — any circular logic, aggressive growth rates, or missing line items?
5. Top 3 Changes — the most important revisions to make the model more defensible

Point out the exact line items that carry the most risk.`,
    categoryId: 9,
    tags: ["finance", "modeling", "stress-test", "valuation"],
  },
  {
    title: "M&A Due Diligence Checklist",
    description: "Generate a tailored due diligence checklist for any M&A transaction.",
    content: `You are an M&A advisor. Generate a comprehensive due diligence checklist for the following transaction:

Target Company: {target_company}
Industry: {industry}
Deal Type: {deal_type} (e.g., acquisition, merger, asset purchase)
Buyer Type: {buyer_type} (e.g., strategic, private equity)

Organize the checklist into sections:
1. Financial Due Diligence
2. Legal & Regulatory
3. Commercial / Market
4. Operational
5. Technology & IP
6. HR & Culture
7. Tax
8. Environmental / ESG

For each section, list 5–8 specific document requests or questions. Flag industry-specific risks unique to {industry}.`,
    categoryId: 9,
    tags: ["finance", "M&A", "due-diligence", "acquisition"],
  },

  // ── Law (categoryId: 10) ────────────────────────────────────
  {
    title: "Contract Risk Review",
    description: "Identify unfavorable clauses, missing provisions, and key risks in any contract.",
    content: `You are a senior commercial attorney. Review the following contract and flag every material risk:

Contract: {contract_text}
Your Client's Role: {client_role} (e.g., buyer, seller, licensor, service provider)
Jurisdiction: {jurisdiction}

Deliver:
1. Executive Summary — 3-sentence risk verdict
2. Unfavorable Clauses — quote each clause and explain the risk
3. Missing Protections — standard provisions that are absent
4. Liability Exposure — cap, indemnification, and warranty analysis
5. Negotiation Priorities — top 5 clauses to push back on, with suggested language

Do not soften your analysis. Flag anything that would give pause to a careful transactional attorney.`,
    categoryId: 10,
    tags: ["law", "contracts", "review", "risk"],
  },
  {
    title: "Legal Research Memo",
    description: "Produce a structured legal research memo on any issue or jurisdiction.",
    content: `You are an associate at a top law firm. Draft a concise legal research memo on the following:

Legal Issue: {legal_issue}
Jurisdiction: {jurisdiction}
Client Situation: {client_situation}

Memo Format:
1. Issue Presented
2. Short Answer
3. Applicable Law — statutes, regulations, and key cases (cite specifically)
4. Analysis — apply the law to the client's facts
5. Counterarguments — strongest opposing position
6. Conclusion and Recommendation

Cite real cases and statutes where possible. Flag if the law is unsettled or varies by circuit/state. Include a disclaimer that this is preliminary research, not legal advice.`,
    categoryId: 10,
    tags: ["law", "research", "memo", "litigation"],
  },
  {
    title: "NDA Term Analysis",
    description: "Analyze an NDA and flag one-sided or unusual terms before signing.",
    content: `You are a commercial attorney specializing in technology and IP transactions. Analyze the following NDA:

NDA Text: {nda_text}
Signing Party: {signing_party} (disclosing or receiving party)
Context: {context} (e.g., vendor evaluation, M&A, partnership discussion)

Review:
1. Definition of Confidential Information — is it too broad or too narrow?
2. Exclusions — are standard carve-outs present (publicly known, independently developed, etc.)?
3. Permitted Disclosures — can you share with employees, advisors, affiliates?
4. Obligations on Receiving Party — are they reasonable?
5. Term and Survival — how long do obligations last after termination?
6. Remedies — injunctive relief clause? Liquidated damages?
7. Mutual vs. One-Sided — is this balanced?
8. Red Flags — any clause you should refuse to sign as written

Provide suggested redline language for the top 3 concerns.`,
    categoryId: 10,
    tags: ["law", "NDA", "contracts", "IP"],
  },
  {
    title: "Regulatory Compliance Gap Analysis",
    description: "Identify compliance gaps and regulatory risks for any business or industry.",
    content: `You are a regulatory compliance attorney. Conduct a gap analysis for the following business:

Business Description: {business_description}
Industry / Sector: {industry}
Jurisdictions of Operation: {jurisdictions}
Current Compliance Measures: {current_measures}

Analyze:
1. Applicable Regulations — key federal, state, and (if relevant) international rules
2. Identified Gaps — specific areas where current measures fall short
3. High-Priority Risks — rank gaps by likelihood and severity of enforcement action
4. Remediation Steps — concrete actions to close each gap
5. Monitoring Cadence — what to review quarterly vs. annually

Be specific about agency names (SEC, FTC, CFPB, etc.) and rule citations. Flag areas where recent regulatory changes are creating new exposure.`,
    categoryId: 10,
    tags: ["law", "compliance", "regulatory", "risk"],
  },
  {
    title: "Dispute Resolution Strategy",
    description: "Develop a litigation or arbitration strategy for any commercial dispute.",
    content: `You are a senior litigation attorney. Develop a dispute resolution strategy for the following matter:

Dispute Summary: {dispute_summary}
Client's Position: {client_position}
Opposing Party: {opposing_party}
Forum: {forum} (e.g., federal court, AAA arbitration, state court)
Desired Outcome: {desired_outcome}

Provide:
1. Threshold Assessment — likelihood of success on the merits (be honest)
2. Key Legal Theories — strongest claims or defenses, with supporting authority
3. Discovery Strategy — what evidence to seek and how
4. Opposing Strategy — anticipate their strongest arguments and how to rebut
5. Settlement Considerations — realistic range and timing to explore settlement
6. Cost-Benefit Analysis — estimated fees vs. likely recovery
7. Recommended Path Forward — litigate, settle, or alternative resolution?`,
    categoryId: 10,
    tags: ["law", "litigation", "dispute", "strategy"],
  },
];

export async function seedPrompts(): Promise<void> {
  // Ensure the system user exists
  await db
    .insert(usersTable)
    .values(SYSTEM_USER)
    .onConflictDoNothing();

  // Insert each prompt only if a prompt with that title doesn't already exist
  for (const prompt of SEED_PROMPTS) {
    const [existing] = await db
      .select({ id: promptsTable.id })
      .from(promptsTable)
      .where(eq(promptsTable.title, prompt.title))
      .limit(1);

    if (!existing) {
      await db.insert(promptsTable).values({
        ...prompt,
        authorUsername: SYSTEM_USER.username,
        isPublic: true,
      });
    }
  }
}
