/**
 * Riigikogu Open Data API Client
 * API Documentation: https://api.riigikogu.ee/swagger-ui.html
 */

import type { MPSearchResult, MPParty } from '@/types';

const BASE_URL = 'https://api.riigikogu.ee/api';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

interface VotingListItem {
  uuid: string;
  title: string;
  votingTime: string;
  votingType: {
    code: string;
    value: string;
  };
  result: string;
}

interface VotingDetail {
  uuid: string;
  title: string;
  votingTime: string;
  votingType: {
    code: string;
    value: string;
  };
  result: string;
  votes: VoteRecord[];
}

// Actual API response format for voting details
interface VotingDetailFull {
  uuid: string;
  description: string;
  startDateTime: string;
  type: {
    code: string;
    value: string;
  };
  present?: number;
  absent?: number;
  inFavor?: number;
  against?: number;
  abstained?: number;
  voters: VoterRecord[];
}

interface VoterRecord {
  uuid: string;
  fullName: string;
  firstName: string;
  lastName: string;
  faction: {
    uuid: string;
    name: string;
    active: boolean;
  } | null;
  decision: {
    code: string;
    value: string;
  };
}

interface VoteRecord {
  memberUuid: string;
  memberFirstName: string;
  memberLastName: string;
  faction: {
    code: string;
    value: string;
  } | null;
  decision: {
    code: string;
    value: string;
  };
}

interface MemberInfo {
  uuid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  active: boolean;
  faction: {
    code: string;
    value: string;
  } | null;
  // New API structure uses factions array
  factions?: {
    uuid: string;
    name: string;
    type: { code: string; value: string };
    active: boolean;
    membership?: {
      startDate: string;
      endDate: string | null;
    };
  }[];
  photo?: {
    uuid: string;
    _links?: {
      download?: { href: string };
    };
  };
}

interface StenogramItem {
  uuid: string;
  sessionDate: string;
  sessionType: string;
  speakers: SpeakerEntry[];
}

interface SpeakerEntry {
  memberUuid: string | null;
  memberFirstName: string | null;
  memberLastName: string | null;
  speakerName: string;
  text: string;
  topic: string | null;
}

// Extended member detail from API
interface MemberDetail {
  uuid: string;
  firstName: string;
  lastName: string;
  faction: {
    code: string;
    value: string;
  } | null;
  photoSmall: string | null;
  photoBig: string | null;
  memberships?: {
    bodyName: string;
    bodyType: string;
    roleName: string;
    startDate: string;
    endDate: string | null;
  }[];
  convocations?: {
    number: number;
    startDate: string;
    endDate: string | null;
  }[];
}

// Party code to name mapping
const PARTY_NAMES: Record<string, { name: string; nameEn: string }> = {
  'EKRE': { name: 'Eesti Konservatiivne Rahvaerakond', nameEn: 'Estonian Conservative People\'s Party' },
  'I': { name: 'Isamaa Erakond', nameEn: 'Isamaa Party' },
  'RE': { name: 'Eesti Reformierakond', nameEn: 'Estonian Reform Party' },
  'SDE': { name: 'Sotsiaaldemokraatlik Erakond', nameEn: 'Social Democratic Party' },
  'K': { name: 'Eesti Keskerakond', nameEn: 'Estonian Centre Party' },
  'E200': { name: 'Eesti 200', nameEn: 'Estonia 200' },
  'PAREMPOOLSED': { name: 'Parempoolsed', nameEn: 'Right-wing' },
  'FR': { name: 'Fraktsioonitud', nameEn: 'Non-affiliated' },
};

async function fetchApi<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
  const url = new URL(`${BASE_URL}${endpoint}`);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      return {
        data: null as T,
        error: `API error: ${response.status} ${response.statusText}`,
      };
    }

    const data = await response.json();
    return { data };
  } catch (error) {
    return {
      data: null as T,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Session with nested votings (actual API response)
interface SessionWithVotings {
  uuid: string;
  title: string;
  sittingDateTime: string;
  votings: {
    uuid: string;
    votingNumber: number;
    type: { code: string; value: string };
    description: string;
    startDateTime: string;
    endDateTime: string;
  }[];
}

/**
 * Get list of votings within a date range
 * Note: API returns sessions with nested votings, we flatten them
 */
export async function getVotings(startDate: string, endDate: string): Promise<ApiResponse<VotingListItem[]>> {
  const response = await fetchApi<SessionWithVotings[]>('/votings', {
    startDate,
    endDate,
    lang: 'et',
  });

  if (response.error || !response.data) {
    return { data: [], error: response.error };
  }

  // Flatten sessions into individual votings
  const votings: VotingListItem[] = [];
  for (const session of response.data) {
    for (const voting of session.votings || []) {
      votings.push({
        uuid: voting.uuid,
        title: voting.description || session.title,
        votingTime: voting.startDateTime,
        votingType: voting.type,
        result: '', // Will be fetched from details
      });
    }
  }

  return { data: votings };
}

/**
 * Get detailed voting information including individual votes
 */
export async function getVotingDetails(votingUuid: string): Promise<ApiResponse<VotingDetail>> {
  return fetchApi<VotingDetail>(`/votings/${votingUuid}`);
}

/**
 * Get member information
 */
export async function getMember(memberUuid: string): Promise<ApiResponse<MemberInfo>> {
  return fetchApi<MemberInfo>(`/plenary-members/${memberUuid}`, { lang: 'ET' });
}

/**
 * Get all current parliament members
 */
export async function getCurrentMembers(): Promise<ApiResponse<MemberInfo[]>> {
  // The Riigikogu API uses /plenary-members endpoint
  // It returns all members, we filter to active ones
  const response = await fetchApi<MemberInfo[]>('/plenary-members', {
    lang: 'ET',
  });

  if (response.error || !response.data) {
    return response;
  }

  // Filter to only active members (current parliament)
  const activeMembers = response.data.filter(member => member.active);
  return { data: activeMembers };
}

// Full stenogram response from /api/steno/verbatims
interface StenoVerbatimResponse {
  membership: number;
  plenarySession: number;
  link: string;
  date: string;
  title: string;
  edited?: boolean;
  agendaItems: {
    agendaItemUuid: string;
    date: string;
    title: string;
    events: {
      type: string;
      uuid: string | null;
      date: string;
      speaker: string | null;
      text: string | null;
      link: string | null;
    }[];
  }[];
}

/**
 * Get stenograms for a date range
 * Uses /api/steno/verbatims endpoint
 * Returns data with embedded speech content
 */
export async function getStenograms(startDate: string, endDate: string): Promise<ApiResponse<StenogramItem[]>> {
  const response = await fetchApi<StenoVerbatimResponse[]>('/steno/verbatims', {
    startDate,
    endDate,
    lang: 'et',
  });

  if (response.error || !response.data) {
    return { data: [], error: response.error };
  }

  // Transform to StenogramItem format
  const stenograms: StenogramItem[] = response.data.map(steno => {
    // Extract all speeches from agendaItems
    const speakers: SpeakerEntry[] = [];
    for (const agendaItem of steno.agendaItems || []) {
      for (const event of agendaItem.events || []) {
        if (event.type === 'SPEECH' && event.text) {
          speakers.push({
            memberUuid: event.uuid,
            memberFirstName: null,
            memberLastName: null,
            speakerName: event.speaker || 'Unknown',
            text: event.text,
            topic: agendaItem.title,
          });
        }
      }
    }

    return {
      uuid: steno.link, // Use link as unique identifier
      sessionDate: steno.date,
      sessionType: 'PLENARY',
      speakers,
    };
  });

  return { data: stenograms };
}

/**
 * Normalize decision code to standard format
 */
export function normalizeDecision(decisionCode: string): 'FOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT' {
  const code = decisionCode.toUpperCase();
  switch (code) {
    case 'FOR':
    case 'POOLT':
    case 'P':
    case 'KOHAL': // Present in roll call - counts as participating
      return 'FOR';
    case 'AGAINST':
    case 'VASTU':
    case 'V':
      return 'AGAINST';
    case 'ABSTAIN':
    case 'ERAPOOLETU':
    case 'E':
      return 'ABSTAIN';
    case 'ABSENT':
    case 'PUUDUB':
    case 'PUUDUS':
    case '-':
    default:
      return 'ABSENT';
  }
}

/**
 * Find a specific MP's vote in a voting
 */
export function findMpVote(voting: VotingDetail, mpUuid: string): VoteRecord | null {
  return voting.votes.find(v => v.memberUuid === mpUuid) || null;
}

/**
 * Extract speech text from stenogram for a specific MP
 */
export function extractMpSpeeches(stenogram: StenogramItem, mpUuid: string): SpeakerEntry[] {
  return stenogram.speakers.filter(s => s.memberUuid === mpUuid);
}

/**
 * Get detailed member information including photo and memberships
 */
export async function getMemberDetails(memberUuid: string): Promise<ApiResponse<MemberDetail>> {
  return fetchApi<MemberDetail>(`/plenary-members/${memberUuid}`, { lang: 'ET' });
}

/**
 * Extract party code from faction name
 */
function extractPartyCode(factionName: string): string {
  // Handle Estonian grammatical cases: Konservatiivne, Konservatiivse, etc.
  if (factionName.includes('Konservatiiv') || factionName.includes('EKRE')) return 'EKRE';
  if (factionName.includes('Isamaa')) return 'I';
  if (factionName.includes('Reform')) return 'RE';
  if (factionName.includes('Sotsiaaldemokraat')) return 'SDE';
  if (factionName.includes('Kesk')) return 'K';
  if (factionName.includes('200')) return 'E200';
  if (factionName.includes('Paremp')) return 'PAREMPOOLSED';
  if (factionName.includes('mittekuuluv') || factionName.includes('Fraktsiooni mittekuuluv')) return 'FR';
  return 'FR';
}

/**
 * Convert faction info to party object
 */
export function factionToParty(faction: { code: string; value: string } | null): MPParty {
  if (!faction) {
    return { code: 'FR', name: 'Fraktsioonitud', nameEn: 'Non-affiliated' };
  }
  const partyInfo = PARTY_NAMES[faction.code];
  return {
    code: faction.code,
    name: partyInfo?.name || faction.value,
    nameEn: partyInfo?.nameEn || faction.value,
  };
}

/**
 * Convert factions array to party object (for new API structure)
 */
export function factionsToParty(factions: MemberInfo['factions']): MPParty {
  if (!factions || factions.length === 0) {
    return { code: 'FR', name: 'Fraktsioonitud', nameEn: 'Non-affiliated' };
  }

  // Find the active faction, or the most recent one
  const activeFaction = factions.find(f => f.active && !f.membership?.endDate);
  const faction = activeFaction || factions[0];

  const code = extractPartyCode(faction.name);
  const partyInfo = PARTY_NAMES[code];

  return {
    code,
    name: partyInfo?.name || faction.name,
    nameEn: partyInfo?.nameEn || faction.name,
  };
}

/**
 * Search for parliament members by name (fuzzy match)
 * Returns current XV convocation members matching the query
 */
export async function searchMembers(query: string): Promise<ApiResponse<MPSearchResult[]>> {
  const { data: members, error } = await getCurrentMembers();

  if (error || !members) {
    return { data: [], error };
  }

  const normalizedQuery = query.toLowerCase().trim();

  // Filter and sort by relevance
  const results = members
    .map(member => {
      const fullName = `${member.firstName} ${member.lastName}`;
      const normalizedFullName = fullName.toLowerCase();
      const normalizedFirst = member.firstName.toLowerCase();
      const normalizedLast = member.lastName.toLowerCase();

      // Calculate match score
      let score = 0;
      if (normalizedFullName === normalizedQuery) {
        score = 100; // Exact match
      } else if (normalizedLast === normalizedQuery) {
        score = 90; // Exact last name match
      } else if (normalizedFirst === normalizedQuery) {
        score = 85; // Exact first name match
      } else if (normalizedFullName.startsWith(normalizedQuery)) {
        score = 80; // Full name starts with query
      } else if (normalizedLast.startsWith(normalizedQuery)) {
        score = 75; // Last name starts with query
      } else if (normalizedFirst.startsWith(normalizedQuery)) {
        score = 70; // First name starts with query
      } else if (normalizedFullName.includes(normalizedQuery)) {
        score = 60; // Full name contains query
      } else if (normalizedLast.includes(normalizedQuery)) {
        score = 50; // Last name contains query
      } else if (normalizedFirst.includes(normalizedQuery)) {
        score = 40; // First name contains query
      } else {
        // Check for fuzzy match (allow some typos)
        const queryChars = normalizedQuery.split('');
        const matchedChars = queryChars.filter(char => normalizedFullName.includes(char));
        if (matchedChars.length >= normalizedQuery.length * 0.7) {
          score = 30;
        }
      }

      return { member, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(({ member }): MPSearchResult => {
      // Use fullName from API if available, otherwise construct it
      const fullName = member.fullName || `${member.firstName} ${member.lastName}`;
      // Use factions array if available (new API), otherwise fall back to faction (old API)
      const party = member.factions ? factionsToParty(member.factions) : factionToParty(member.faction);
      // Get photo URL from API response if available
      const photoUrl = member.photo?._links?.download?.href || null;

      return {
        uuid: member.uuid,
        firstName: member.firstName,
        lastName: member.lastName,
        fullName,
        party,
        photoUrl,
        isCurrentMember: true,
      };
    });

  return { data: results };
}

/**
 * Get full member details including photo and committee memberships
 */
export async function getFullMemberDetails(memberUuid: string): Promise<ApiResponse<{
  uuid: string;
  firstName: string;
  lastName: string;
  fullName: string;
  party: MPParty;
  photoUrl: string | null;
  committees: { name: string; role: string }[];
  previousTerms: number[];
}>> {
  const { data: member, error } = await getMemberDetails(memberUuid);

  if (error || !member) {
    return { data: null as any, error };
  }

  // Extract committee memberships (current ones)
  const committees = (member.memberships || [])
    .filter(m => m.bodyType === 'COMMITTEE' && !m.endDate)
    .map(m => ({
      name: m.bodyName,
      role: m.roleName || 'Liige',
    }));

  // Extract previous Riigikogu terms
  const previousTerms = (member.convocations || [])
    .filter(c => c.number < 15)
    .map(c => c.number)
    .sort((a, b) => a - b);

  return {
    data: {
      uuid: member.uuid,
      firstName: member.firstName,
      lastName: member.lastName,
      fullName: `${member.firstName} ${member.lastName}`,
      party: factionToParty(member.faction),
      photoUrl: member.photoBig || member.photoSmall || null,
      committees,
      previousTerms,
    },
  };
}

/**
 * Get all votes for a specific MP within a date range
 */
export async function getMpVotes(
  mpUuid: string,
  startDate: string,
  endDate: string
): Promise<ApiResponse<{
  votingUuid: string;
  votingTitle: string;
  votingDate: string;
  decision: 'FOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT';
  party: string;
}[]>> {
  const { data: votings, error: votingsError } = await getVotings(startDate, endDate);

  if (votingsError || !votings) {
    return { data: [], error: votingsError };
  }

  const mpVotes: {
    votingUuid: string;
    votingTitle: string;
    votingDate: string;
    decision: 'FOR' | 'AGAINST' | 'ABSTAIN' | 'ABSENT';
    party: string;
  }[] = [];

  for (const voting of votings) {
    const { data: details } = await getVotingDetails(voting.uuid);
    if (details) {
      const mpVote = findMpVote(details, mpUuid);
      if (mpVote) {
        mpVotes.push({
          votingUuid: voting.uuid,
          votingTitle: voting.title,
          votingDate: voting.votingTime,
          decision: normalizeDecision(mpVote.decision.code),
          party: mpVote.faction?.code || 'FR',
        });
      }
    }
    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { data: mpVotes };
}

/**
 * Get all speeches for a specific MP within a date range
 */
export async function getMpSpeeches(
  mpUuid: string,
  startDate: string,
  endDate: string
): Promise<ApiResponse<{
  sessionDate: string;
  sessionType: string;
  topic: string | null;
  text: string;
}[]>> {
  const { data: stenograms, error: stenogramError } = await getStenograms(startDate, endDate);

  if (stenogramError || !stenograms) {
    return { data: [], error: stenogramError };
  }

  const speeches: {
    sessionDate: string;
    sessionType: string;
    topic: string | null;
    text: string;
  }[] = [];

  for (const stenogram of stenograms) {
    const mpSpeeches = extractMpSpeeches(stenogram, mpUuid);
    for (const speech of mpSpeeches) {
      speeches.push({
        sessionDate: stenogram.sessionDate,
        sessionType: stenogram.sessionType,
        topic: speech.topic,
        text: speech.text,
      });
    }
  }

  return { data: speeches };
}

// ============================================
// Full API Clone Endpoints
// ============================================

/**
 * Get all parliament members (including inactive from current convocation)
 */
export async function getAllPlenaryMembers(): Promise<ApiResponse<MemberInfo[]>> {
  return fetchApi<MemberInfo[]>('/plenary-members', { lang: 'ET' });
}

/**
 * Get detailed voting with all voters (full data)
 * Returns voting with complete vote breakdown for all MPs
 * Transforms API response to expected format
 */
export async function getVotingDetailsFull(votingUuid: string): Promise<ApiResponse<VotingDetail>> {
  const response = await fetchApi<VotingDetailFull>(`/votings/${votingUuid}`, { lang: 'et' });

  if (response.error || !response.data) {
    return { data: null as any, error: response.error };
  }

  const apiData = response.data;

  // Transform voters to votes format expected by sync code
  const votes: VoteRecord[] = (apiData.voters || []).map(voter => ({
    memberUuid: voter.uuid,
    memberFirstName: voter.firstName,
    memberLastName: voter.lastName,
    faction: voter.faction ? {
      code: extractPartyCode(voter.faction.name),
      value: voter.faction.name,
    } : null,
    decision: voter.decision,
  }));

  // Determine result from vote counts
  let result = 'unknown';
  if (apiData.inFavor !== undefined && apiData.against !== undefined) {
    result = apiData.inFavor > apiData.against ? 'ACCEPTED' : 'REJECTED';
  }

  return {
    data: {
      uuid: apiData.uuid,
      title: apiData.description,
      votingTime: apiData.startDateTime,
      votingType: apiData.type,
      result,
      votes,
    }
  };
}

// Draft list response from API (actual format from /api/volumes/drafts)
interface DraftListItem {
  uuid: string;
  title: string;
  mark?: number;  // Bill number
  number?: string;  // Alternative number field
  copyOrOriginal?: string;
  membership?: number;
  draftTypeCode?: string;
  draftType?: {
    code: string;
    value: string;
  };
  activeDraftStage?: string;
  activeDraftStatus?: string;
  draftStatus?: {
    code: string;
    value: string;
  };
  proceedingStatus?: string;
  activeDraftStatusDate?: string;
  initiated?: string;  // Submit date
  submitDate?: string;
  proceedingDate?: string;
  initiators?: { name: string }[];
  leadingCommittee?: {
    uuid: string;
    name: string;
  };
}

// Draft detail response from API
interface DraftDetail {
  uuid: string;
  number: string;
  title: string;
  draftType: {
    code: string;
    value: string;
  };
  draftStatus: {
    code: string;
    value: string;
  };
  initiators?: { name: string }[];
  submitDate?: string;
  proceedingDate?: string;
  relatedVotings?: { uuid: string }[];
}

// Paginated response format from Riigikogu API
interface PaginatedResponse<T> {
  _embedded?: {
    content: T[];
  };
  page?: {
    size: number;
    totalElements: number;
    totalPages: number;
    number: number;
  };
}

/**
 * Get drafts (bills) within a date range
 * Uses /api/volumes/drafts endpoint
 * Handles paginated response format
 */
export async function getDrafts(startDate: string, endDate: string): Promise<ApiResponse<DraftListItem[]>> {
  const response = await fetchApi<PaginatedResponse<DraftListItem>>('/volumes/drafts', {
    startDate,
    endDate,
    lang: 'et',
    size: '500', // Request more items per page
  });

  if (response.error || !response.data) {
    return { data: [], error: response.error };
  }

  // Extract content from _embedded wrapper
  const drafts = response.data._embedded?.content || [];
  return { data: drafts };
}

/**
 * Get draft details by UUID
 * Uses /api/volumes/drafts/{uuid} endpoint
 */
export async function getDraftDetails(draftUuid: string): Promise<ApiResponse<DraftDetail>> {
  return fetchApi<DraftDetail>(`/volumes/drafts/${draftUuid}`, { lang: 'et' });
}

// Verbatim stenogram response
interface StenogramVerbatim {
  uuid: string;
  sittingDate: string;
  sittingNumber?: number;
  sessionType?: string;
  verbatimTexts?: {
    speakerUuid: string | null;
    speakerName: string;
    speakerTitle?: string;
    text: string;
    topic?: string;
  }[];
}

/**
 * Get verbatim stenogram texts
 * Uses /api/steno/verbatims/{uuid} endpoint
 */
export async function getStenogramVerbatim(stenogramUuid: string): Promise<ApiResponse<StenogramVerbatim>> {
  return fetchApi<StenogramVerbatim>(`/steno/verbatims/${stenogramUuid}`, { lang: 'et' });
}

/**
 * Get stenogram list for date range
 * Uses /api/steno/verbatims endpoint
 */
export async function getStenogramList(startDate: string, endDate: string): Promise<ApiResponse<{
  uuid: string;
  sittingDate: string;
  sittingNumber?: number;
  sessionType?: string;
}[]>> {
  return fetchApi('/steno/verbatims', {
    startDate,
    endDate,
    lang: 'et',
  });
}

export type {
  VotingListItem,
  VotingDetail,
  VoteRecord,
  MemberInfo,
  MemberDetail,
  StenogramItem,
  SpeakerEntry,
  DraftListItem,
  DraftDetail,
  StenogramVerbatim,
};
