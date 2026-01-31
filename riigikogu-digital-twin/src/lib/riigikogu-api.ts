/**
 * Riigikogu Open Data API Client
 * API Documentation: https://api.riigikogu.ee/swagger-ui.html
 */

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
  faction: {
    code: string;
    value: string;
  } | null;
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

/**
 * Get list of votings within a date range
 */
export async function getVotings(startDate: string, endDate: string): Promise<ApiResponse<VotingListItem[]>> {
  return fetchApi<VotingListItem[]>('/votings', {
    startDate,
    endDate,
    lang: 'et',
  });
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
  return fetchApi<MemberInfo>(`/members/${memberUuid}`);
}

/**
 * Get all current parliament members
 */
export async function getCurrentMembers(): Promise<ApiResponse<MemberInfo[]>> {
  return fetchApi<MemberInfo[]>('/members', {
    convocation: '15', // XV Riigikogu (2023-2027)
  });
}

/**
 * Get stenograms for a date range
 */
export async function getStenograms(startDate: string, endDate: string): Promise<ApiResponse<StenogramItem[]>> {
  return fetchApi<StenogramItem[]>('/stenograms', {
    startDate,
    endDate,
  });
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

export type { VotingListItem, VotingDetail, VoteRecord, MemberInfo, StenogramItem, SpeakerEntry };
