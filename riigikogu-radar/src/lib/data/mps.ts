/**
 * MP data access layer
 */

import { getCollection } from "./mongodb";
import { collectMPData, generateMPInstruction } from "../ai/instruction-generator";
import { generateSlug } from "../utils/slug";
import { extractPhotoUrl } from "../utils/photo";
import type { MP, MPStatus, MPProfile } from "@/types";

/**
 * Get all MPs with optional filters
 */
export async function getMPs(options: {
  status?: MPStatus;
  isCurrentMember?: boolean;
  party?: string;
} = {}): Promise<MP[]> {
  const collection = await getCollection<MP>("mps");

  const filter: Record<string, unknown> = {};
  if (options.status) filter.status = options.status;
  if (options.isCurrentMember !== undefined) filter.isCurrentMember = options.isCurrentMember;
  if (options.party) filter.party = options.party;

  return collection.find(filter).sort({ name: 1 }).toArray();
}

/**
 * Get active MPs (status = "active")
 * Returns MPProfile[] for use in predictions
 */
export async function getActiveMPs(): Promise<MPProfile[]> {
  const collection = await getCollection<MPProfile>("mps");
  return collection.find({ status: "active" }).sort({ "info.fullName": 1 }).toArray();
}

/**
 * Get MP by slug (returns MPProfile for full data access)
 */
export async function getMPBySlug(slug: string): Promise<MPProfile | null> {
  const collection = await getCollection<MPProfile>("mps");
  return collection.findOne({ slug });
}

/**
 * Get MP by member UUID
 */
export async function getMPByUuid(memberUuid: string): Promise<MP | null> {
  const collection = await getCollection<MP>("mps");
  return collection.findOne({ memberUuid });
}

/**
 * Create or update MP
 */
export async function upsertMP(mp: Partial<MP> & { slug: string }): Promise<void> {
  const collection = await getCollection<MP>("mps");

  await collection.updateOne(
    { slug: mp.slug },
    {
      $set: {
        ...mp,
        updatedAt: new Date(),
      },
      $setOnInsert: {
        createdAt: new Date(),
      },
    },
    { upsert: true }
  );
}

/**
 * Update MP status
 */
export async function updateMPStatus(slug: string, status: MPStatus): Promise<void> {
  const collection = await getCollection<MP>("mps");

  await collection.updateOne(
    { slug },
    {
      $set: {
        status,
        updatedAt: new Date(),
      },
    }
  );
}

/**
 * Get distinct parties from MPs
 */
export async function getParties(): Promise<string[]> {
  const collection = await getCollection<MP>("mps");
  return collection.distinct("party");
}

/**
 * Get all MPs as MPProfile format (for scripts)
 */
export async function getAllMPs(): Promise<{ mps: MPProfile[] }> {
  const collection = await getCollection<MPProfile>("mps");
  const mps = await collection.find({ status: "active" }).sort({ "info.fullName": 1 }).toArray();
  return { mps };
}

/**
 * Create MP profile stubs from members collection
 * Returns count of newly created profiles
 */
export async function createMPsFromMembers(): Promise<{ created: number; existing: number }> {
  const mpsCollection = await getCollection<MPProfile>("mps");
  const membersCollection = await getCollection<{
    uuid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    active?: boolean;
    faction?: { name?: string; code?: string };
  }>("members");

  // Get all current members (use 'active' field from Riigikogu API)
  const members = await membersCollection.find({ active: true }).toArray();

  let created = 0;
  let existing = 0;

  for (const member of members) {
    // Check if MP already exists
    const existingMP = await mpsCollection.findOne({ uuid: member.uuid });
    if (existingMP) {
      existing++;
      continue;
    }

    // Create slug from name
    const slug = generateSlug(member.fullName);

    // Create stub profile
    const profile: Omit<MPProfile, "_id"> = {
      uuid: member.uuid,
      slug,
      status: "pending" as MPStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await mpsCollection.insertOne(profile as MPProfile);
    created++;
  }

  return { created, existing };
}

/**
 * Regenerate MP profile with fresh AI analysis
 * Creates the MP profile if it doesn't exist
 */
export async function regenerateMPProfile(uuid: string): Promise<MPProfile> {
  const mpsCollection = await getCollection<MPProfile>("mps");
  const membersCollection = await getCollection<{
    uuid: string;
    firstName: string;
    lastName: string;
    fullName: string;
    faction?: { name?: string; value?: string; code?: string; nameEn?: string };
    photoUrl?: string | { uuid?: string; _links?: { download?: { href?: string } } };
    committeeMemberships?: Array<{ committee?: { name?: string }; role?: string }>;
    previousConvocations?: Array<{ number?: number }>;
    convocations?: Array<{ number?: number }>;
    committees?: Array<{ committee?: { name?: string }; role?: { code?: string; value?: string } }>;
  }>("members");

  // Get member details from members collection
  const member = await membersCollection.findOne({ uuid });
  if (!member) {
    throw new Error(`Member details not found: ${uuid}`);
  }

  // Check if MP exists, create stub if not
  let existing = await mpsCollection.findOne({ uuid });
  if (!existing) {
    // Create slug from name
    const slug = generateSlug(member.fullName);

    const stub: Omit<MPProfile, "_id"> = {
      uuid,
      slug,
      status: "pending" as MPStatus,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await mpsCollection.insertOne(stub as MPProfile);
    existing = await mpsCollection.findOne({ uuid });
  }

  // Collect voting and speech data
  const mpData = await collectMPData(uuid);

  // Build member details for instruction generator
  // Note: faction uses 'value' field in API data, fallback to 'name' for compatibility
  const factionName = member.faction?.value || member.faction?.name || "Unknown";
  const memberDetails = {
    uuid: member.uuid,
    firstName: member.firstName,
    lastName: member.lastName,
    fullName: member.fullName,
    party: {
      code: member.faction?.code || "other",
      name: factionName,
      nameEn: member.faction?.nameEn || factionName,
    },
    photoUrl: extractPhotoUrl(member.photoUrl) || null,
    committees: (member.committees || member.committeeMemberships || []).map(cm => ({
      name: cm.committee?.name || "Unknown",
      role: typeof cm.role === "object" ? cm.role.value || "Member" : cm.role || "Member",
    })),
    previousTerms: (member.convocations || member.previousConvocations || [])
      .filter(c => c.number !== undefined)
      .map(c => c.number as number),
  };

  // Generate new AI instruction
  const { info, instruction } = await generateMPInstruction(memberDetails, mpData);

  // Update MP profile
  const update = {
    $set: {
      info,
      instruction,
      status: "active" as MPStatus,
      updatedAt: new Date(),
    },
  };

  await mpsCollection.updateOne({ uuid }, update);

  // Return updated profile
  const updated = await mpsCollection.findOne({ uuid });
  if (!updated) {
    throw new Error(`Failed to retrieve updated MP: ${uuid}`);
  }

  return updated;
}
