/**
 * Instruction Generator - Analyzes MP data and generates AI instruction templates
 */

import Anthropic from '@anthropic-ai/sdk';
import { getCollection } from '../data/mongodb';
import type {
  MPInfo,
  MPInstructionFull,
  MPParty,
  MPVotingStats,
  MPPolicyArea,
  MPNotableVote,
  MPPoliticalProfile,
  MPBehavioralPatterns,
  MPDecisionFactors,
  VoteDecision,
} from '@/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY?.trim(),
});

const MODEL = 'claude-sonnet-4-20250514';

// XV Riigikogu start date
const CONVOCATION_START = '2023-04-01';

export interface MPDataCollection {
  votes: Array<{
    id: string;
    votingTitle: string;
    decision: string;
    date: string;
    party: string;
  }>;
  speeches: Array<{
    sessionDate: string;
    topic: string | null;
    text: string;
  }>;
  partyVotingPatterns: Map<string, { total: number; sameAsParty: number }>;
}

/**
 * Collect voting and speech data for an MP from the database
 */
export async function collectMPData(mpUuid: string): Promise<MPDataCollection> {
  const votingsCollection = await getCollection<{
    uuid: string;
    title: string;
    votingTime: string;
    voters: Array<{
      memberUuid: string;
      fullName: string;
      faction: string;
      decision: string;
    }>;
  }>('votings');

  const stenogramsCollection = await getCollection<{
    uuid: string;
    sessionDate: string;
    speakers: Array<{
      memberUuid: string | null;
      fullName: string;
      text: string;
      topic: string | null;
    }>;
  }>('stenograms');

  // Get all votings where this MP voted
  const votingDocs = await votingsCollection.find({
    'voters.memberUuid': mpUuid
  }).sort({ votingTime: -1 }).toArray();

  // Extract MP's votes from the embedded voters array
  const votes = votingDocs.map(voting => {
    const mpVote = voting.voters.find(v => v.memberUuid === mpUuid);
    return {
      id: voting.uuid,
      votingTitle: voting.title,
      decision: mpVote?.decision || 'ABSENT',
      date: voting.votingTime,
      party: mpVote?.faction || '',
    };
  });

  // Get all stenograms where this MP spoke
  const stenogramDocs = await stenogramsCollection.find({
    'speakers.memberUuid': mpUuid
  }).sort({ sessionDate: -1 }).toArray();

  // Extract MP's speeches from the embedded speakers array
  const speeches: Array<{ sessionDate: string; topic: string | null; text: string }> = [];
  for (const stenogram of stenogramDocs) {
    const mpSpeeches = stenogram.speakers.filter(s => s.memberUuid === mpUuid);
    for (const speech of mpSpeeches) {
      speeches.push({
        sessionDate: stenogram.sessionDate,
        topic: speech.topic,
        text: speech.text,
      });
    }
  }

  // Calculate party voting patterns (for party loyalty calculation)
  // This would ideally compare with party majority votes, but for now we'll estimate
  const partyVotingPatterns = new Map<string, { total: number; sameAsParty: number }>();

  return { votes, speeches, partyVotingPatterns };
}

/**
 * Calculate voting statistics
 */
function calculateVotingStats(votes: MPDataCollection['votes']): MPVotingStats {
  const distribution = {
    FOR: 0,
    AGAINST: 0,
    ABSTAIN: 0,
    ABSENT: 0,
  };

  for (const vote of votes) {
    const decision = vote.decision as keyof typeof distribution;
    if (decision in distribution) {
      distribution[decision]++;
    }
  }

  const total = votes.length;
  const attended = total - distribution.ABSENT;
  const attendancePercent = total > 0 ? Math.round((attended / total) * 100) : 0;

  // Party loyalty would need comparison with party majority votes
  // For now, estimate based on voting patterns
  const partyLoyaltyPercent = 85; // Default estimate

  return {
    total,
    distribution,
    partyLoyaltyPercent,
    attendancePercent,
  };
}

/**
 * Extract policy areas from votes and speeches
 */
function extractPolicyAreas(
  votes: MPDataCollection['votes'],
  speeches: MPDataCollection['speeches']
): MPPolicyArea[] {
  const areaKeywords: Record<string, { area: string; areaEn: string; keywords: string[] }> = {
    haridus: {
      area: 'Haridus',
      areaEn: 'Education',
      keywords: ['haridus', 'kool', 'õpi', 'ülikool', 'education', 'school', 'student'],
    },
    kultuur: {
      area: 'Kultuur',
      areaEn: 'Culture',
      keywords: ['kultuur', 'kunst', 'muuseum', 'keel', 'culture', 'language', 'heritage'],
    },
    majandus: {
      area: 'Majandus',
      areaEn: 'Economy',
      keywords: ['majandus', 'eelarve', 'maks', 'ettevõt', 'economy', 'budget', 'tax', 'business'],
    },
    sotsiaal: {
      area: 'Sotsiaalpoliitika',
      areaEn: 'Social Policy',
      keywords: ['sotsiaal', 'pension', 'toetus', 'tervis', 'social', 'welfare', 'health'],
    },
    riigikaitse: {
      area: 'Riigikaitse',
      areaEn: 'Defense',
      keywords: ['kaitse', 'sõjaväe', 'nato', 'julgeole', 'defense', 'military', 'security'],
    },
    välispoliitika: {
      area: 'Välispoliitika',
      areaEn: 'Foreign Policy',
      keywords: ['välis', 'euroop', 'rahvusvahel', 'foreign', 'europe', 'international'],
    },
    keskkond: {
      area: 'Keskkond',
      areaEn: 'Environment',
      keywords: ['keskkond', 'kliima', 'loodus', 'energia', 'environment', 'climate', 'energy'],
    },
    õigus: {
      area: 'Õigus ja siseturvalisus',
      areaEn: 'Law and Internal Security',
      keywords: ['seadus', 'kohus', 'politsei', 'õigus', 'law', 'court', 'police', 'justice'],
    },
  };

  const areaCounts: Record<string, number> = {};

  // Count policy area mentions in vote titles
  for (const vote of votes) {
    const titleLower = vote.votingTitle.toLowerCase();
    for (const [key, { keywords }] of Object.entries(areaKeywords)) {
      if (keywords.some(kw => titleLower.includes(kw))) {
        areaCounts[key] = (areaCounts[key] || 0) + 1;
      }
    }
  }

  // Count in speeches too
  for (const speech of speeches) {
    const textLower = (speech.topic || '').toLowerCase() + ' ' + speech.text.toLowerCase();
    for (const [key, { keywords }] of Object.entries(areaKeywords)) {
      if (keywords.some(kw => textLower.includes(kw))) {
        areaCounts[key] = (areaCounts[key] || 0) + 1;
      }
    }
  }

  // Convert to sorted array
  return Object.entries(areaCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([key, count]) => ({
      area: areaKeywords[key].area,
      areaEn: areaKeywords[key].areaEn,
      count,
    }));
}

/**
 * Identify notable/significant votes
 */
function identifyNotableVotes(votes: MPDataCollection['votes']): MPNotableVote[] {
  // Notable votes would typically be:
  // 1. Votes where MP voted differently from party majority
  // 2. Important constitutional or treaty votes
  // 3. Controversial legislation

  const notableKeywords = [
    'põhiseadus', 'constitution',
    'eelarve', 'budget',
    'maksusead', 'tax law',
    'pension',
    'haridussead', 'education law',
    'kaitseväe', 'defense',
    'euroopa', 'europe',
  ];

  return votes
    .filter(v => {
      const titleLower = v.votingTitle.toLowerCase();
      return notableKeywords.some(kw => titleLower.includes(kw));
    })
    .slice(0, 5)
    .map(v => ({
      title: v.votingTitle,
      decision: v.decision as VoteDecision,
      date: v.date,
      reason: 'Significant legislation',
    }));
}

/**
 * Generate AI instruction using Claude
 */
async function generateAIInstruction(
  memberDetails: {
    firstName: string;
    lastName: string;
    fullName: string;
    party: MPParty;
  },
  stats: MPVotingStats,
  policyAreas: MPPolicyArea[],
  speeches: MPDataCollection['speeches']
): Promise<{
  politicalProfile: MPPoliticalProfile;
  behavioralPatterns: MPBehavioralPatterns;
  decisionFactors: MPDecisionFactors;
  promptTemplate: string;
}> {
  // Sample speeches for analysis (limit to avoid token limits)
  const speechSamples = speeches.slice(0, 10).map(s => ({
    topic: s.topic || 'Unknown',
    excerpt: s.text.substring(0, 500),
  }));

  const analysisPrompt = `Analyze this Estonian Member of Parliament and generate a political profile for vote prediction.

## MP Information
- Name: ${memberDetails.fullName}
- Party: ${memberDetails.party.name} (${memberDetails.party.code})
- Party (English): ${memberDetails.party.nameEn}

## Voting Statistics
- Total votes cast: ${stats.total}
- FOR votes: ${stats.distribution.FOR}
- AGAINST votes: ${stats.distribution.AGAINST}
- ABSTAIN: ${stats.distribution.ABSTAIN}
- ABSENT: ${stats.distribution.ABSENT}
- Attendance: ${stats.attendancePercent}%

## Top Policy Areas (by activity)
${policyAreas.map(a => `- ${a.areaEn}: ${a.count} relevant votes/speeches`).join('\n')}

## Sample Speech Excerpts
${speechSamples.map((s, i) => `${i + 1}. Topic: ${s.topic}\n"${s.excerpt}..."`).join('\n\n')}

## Instructions
Based on this data, analyze the MP's political positions and behavioral patterns.
Consider Estonian political context and party positions.

Respond in JSON format:
{
  "politicalProfile": {
    "economicScale": <-100 to 100, left to right>,
    "socialScale": <-100 to 100, liberal to conservative>,
    "keyIssues": [
      {
        "issue": "<issue in Estonian>",
        "issueEn": "<issue in English>",
        "stance": "<stance description in Estonian>",
        "stanceEn": "<stance description in English>",
        "confidence": <0-100>
      }
    ]
  },
  "behavioralPatterns": {
    "partyLoyalty": "high" | "medium" | "low",
    "independenceIndicators": ["<indicator in Estonian>"],
    "independenceIndicatorsEn": ["<indicator in English>"]
  },
  "decisionFactors": {
    "primaryFactors": ["<factor in Estonian>"],
    "primaryFactorsEn": ["<factor in English>"],
    "redFlags": ["<topic triggering opposition in Estonian>"],
    "redFlagsEn": ["<topic triggering opposition in English>"],
    "greenFlags": ["<topic triggering support in Estonian>"],
    "greenFlagsEn": ["<topic triggering support in English>"]
  }
}`;

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: analysisPrompt,
      },
    ],
  });

  const textContent = response.content.find(c => c.type === 'text');
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude');
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from response');
  }

  const analysis = JSON.parse(jsonMatch[0]);

  // Generate the prompt template
  const promptTemplate = generatePromptTemplate(
    memberDetails,
    stats,
    policyAreas,
    analysis.politicalProfile,
    analysis.behavioralPatterns,
    analysis.decisionFactors
  );

  return {
    politicalProfile: analysis.politicalProfile,
    behavioralPatterns: analysis.behavioralPatterns,
    decisionFactors: analysis.decisionFactors,
    promptTemplate,
  };
}

/**
 * Generate the prompt template for vote prediction
 */
function generatePromptTemplate(
  memberDetails: { fullName: string; party: MPParty },
  stats: MPVotingStats,
  policyAreas: MPPolicyArea[],
  politicalProfile: MPPoliticalProfile,
  behavioralPatterns: MPBehavioralPatterns,
  decisionFactors: MPDecisionFactors
): string {
  const keyIssuesText = politicalProfile.keyIssues
    .map(i => `- ${i.issueEn}: ${i.stanceEn} (confidence: ${i.confidence}%)`)
    .join('\n');

  const greenFlagsText = decisionFactors.greenFlagsEn?.join(', ') || decisionFactors.greenFlags.join(', ');
  const redFlagsText = decisionFactors.redFlagsEn?.join(', ') || decisionFactors.redFlags.join(', ');
  const primaryFactorsText = decisionFactors.primaryFactorsEn?.join(', ') || decisionFactors.primaryFactors.join(', ');
  const independenceText = behavioralPatterns.independenceIndicatorsEn?.join(', ') || behavioralPatterns.independenceIndicators.join(', ');

  return `# MP Digital Twin: ${memberDetails.fullName}

## Identity
You are simulating **${memberDetails.fullName}** (${memberDetails.party.nameEn}), member of Riigikogu XV.

## Political Position
- Economic scale: ${politicalProfile.economicScale}/100 (negative=left, positive=right)
- Social scale: ${politicalProfile.socialScale}/100 (negative=liberal, positive=conservative)

## Key Positions
${keyIssuesText}

## Decision Factors
**Support triggers:** ${greenFlagsText}
**Opposition triggers:** ${redFlagsText}
**Primary decision factors:** ${primaryFactorsText}

## Behavioral Patterns
- Party loyalty: ${behavioralPatterns.partyLoyalty} (${stats.partyLoyaltyPercent}%)
- Independence indicators: ${independenceText}

## Voting Statistics
- Total votes: ${stats.total}
- Attendance: ${stats.attendancePercent}%
- Distribution: FOR ${stats.distribution.FOR}, AGAINST ${stats.distribution.AGAINST}, ABSTAIN ${stats.distribution.ABSTAIN}

## Top Policy Areas
${policyAreas.map(a => `- ${a.areaEn}: ${a.count} related activities`).join('\n')}

## Instruction
When predicting how ${memberDetails.fullName} would vote, consider:
1. Their established positions on key issues
2. Party alignment and dynamics
3. Similar past votes on related topics
4. Relevant speeches and public statements
5. The bill's alignment with support/opposition triggers

Provide reasoning that reflects their known values and voting patterns.`;
}

/**
 * Main function to generate MP instruction from collected data
 */
export async function generateMPInstruction(
  memberDetails: {
    uuid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    party: MPParty;
    photoUrl: string | null;
    committees: { name: string; role: string }[];
    previousTerms: number[];
  },
  mpData: MPDataCollection
): Promise<{ info: MPInfo; instruction: MPInstructionFull }> {
  // Calculate statistics
  const votingStats = calculateVotingStats(mpData.votes);

  // Extract policy areas
  const policyAreas = extractPolicyAreas(mpData.votes, mpData.speeches);

  // Identify notable votes
  const notableVotes = identifyNotableVotes(mpData.votes);

  // Generate AI analysis
  const aiAnalysis = await generateAIInstruction(
    memberDetails,
    votingStats,
    policyAreas,
    mpData.speeches
  );

  // Build info section
  const info: MPInfo = {
    firstName: memberDetails.firstName,
    lastName: memberDetails.lastName,
    fullName: memberDetails.fullName,
    party: memberDetails.party,
    photoUrl: memberDetails.photoUrl,
    committees: memberDetails.committees.map(c => ({
      name: c.name,
      role: c.role,
    })),
    previousTerms: memberDetails.previousTerms,
    votingStats,
    policyAreas,
    notableVotes,
  };

  // Build instruction section
  const instruction: MPInstructionFull = {
    version: 1,
    generatedAt: new Date(),
    promptTemplate: aiAnalysis.promptTemplate,
    politicalProfile: aiAnalysis.politicalProfile,
    behavioralPatterns: aiAnalysis.behavioralPatterns,
    decisionFactors: aiAnalysis.decisionFactors,
  };

  return { info, instruction };
}

/**
 * Get prompt template for an MP (for use in predictions)
 */
export async function getMPPromptTemplate(mpUuid: string): Promise<string | null> {
  const collection = await getCollection<{
    uuid: string;
    instruction?: { promptTemplate?: string };
  }>('mps');

  const mp = await collection.findOne({ uuid: mpUuid });
  return mp?.instruction?.promptTemplate || null;
}
